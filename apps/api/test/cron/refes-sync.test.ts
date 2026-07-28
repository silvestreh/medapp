import assert from 'assert';
import app from '../../src/app';
import { applyEstablishments, parseRefesCsv, pickLatestResource } from '../../src/cron/refes-sync';

const SAMPLE_CSV = `"establecimiento_id","establecimiento_nombre","localidad_id","localidad_nombre","provincia_id","provincia_nombre","departamento_id","departamento_nombre","codloc","codent","origen_financiamiento","tipologia_id","tipologia_sigla","tipologia_nombre","cp","domicilio","sitio_web","longitud","latitud"
"52500282358948",KHUSKA CENTRO EDUCATIVO TERAPEUTICO.-,"50028020014",VILLA NUEVA,"50",MENDOZA,"028",GUAYMALLÉN,"020","014",Privado,52,ESSIT,Centro educativo terapéutico,"5521",REPÚBLICA DE SIRIA 3454,www.khuska-cet.com.ar,-68.798192,-32.89943
"15062032307579",HOGAR DE ANCIANOS HORACIO CARLOS COOK,"06203050000",HUANGUELEN,"06",BUENOS AIRES,"203",CORONEL SUÁREZ,"050","000",Privado,17,ESCIRES,Vivienda para personas mayores,"7545","30 e/ 5 Y 6",,-61.93989872932434,-37.05810960605219
"15062032307579",DUPLICADO MISMO ID,"06203050000",HUANGUELEN,"06",BUENOS AIRES,"203",CORONEL SUÁREZ,"050","000",Privado,17,ESCIRES,Vivienda,"7545","30",,-61.9,-37.0
"","SIN ID",,,,,,,,,,,,,,,,,`;

describe('REFES sync', () => {
  describe('parseRefesCsv', () => {
    it('parses establishments from the SISA CSV format', () => {
      const result = parseRefesCsv(SAMPLE_CSV);
      assert.strictEqual(result.length, 2);

      const first = result[0];
      assert.strictEqual(first.id, '52500282358948');
      assert.strictEqual(first.name, 'KHUSKA CENTRO EDUCATIVO TERAPEUTICO.-');
      assert.strictEqual(first.province, 'MENDOZA');
      assert.strictEqual(first.department, 'GUAYMALLÉN');
      assert.strictEqual(first.city, 'VILLA NUEVA');
      assert.strictEqual(first.postalCode, '5521');
      assert.strictEqual(first.address, 'REPÚBLICA DE SIRIA 3454');
      assert.strictEqual(first.website, 'www.khuska-cet.com.ar');
      assert.strictEqual(first.financing, 'Privado');
      assert.strictEqual(first.typologyAcronym, 'ESSIT');
    });

    it('maps empty strings to null', () => {
      const result = parseRefesCsv(SAMPLE_CSV);
      assert.strictEqual(result[1].website, null);
    });

    it('skips duplicated ids and rows without id', () => {
      const result = parseRefesCsv(SAMPLE_CSV);
      const ids = result.map((r) => r.id);
      assert.deepStrictEqual(ids, ['52500282358948', '15062032307579']);
      // First occurrence wins
      assert.strictEqual(result[1].name, 'HOGAR DE ANCIANOS HORACIO CARLOS COOK');
    });
  });

  describe('pickLatestResource', () => {
    it('picks the most recent CSV resource', () => {
      const chosen = pickLatestResource([
        { name: 'REFES 2021', format: 'CSV', url: 'https://x/2021.csv', last_modified: '2021-02-08T16:10:56' },
        { name: 'REFES 2025', format: 'CSV', url: 'https://x/2025.csv', last_modified: '2025-12-17T15:53:47' },
        { name: 'Documentación', format: 'PDF', url: 'https://x/doc.pdf', last_modified: '2025-12-17T15:50:52' },
      ]);
      assert.strictEqual(chosen?.url, 'https://x/2025.csv');
    });

    it('still picks the CSV when a newer XLSX exists', () => {
      const chosen = pickLatestResource([
        { name: 'REFES 2025', format: 'CSV', url: 'https://x/2025.csv', last_modified: '2025-12-17T15:53:47' },
        { name: 'REFES 2026', format: 'XLSX', url: 'https://x/2026.xlsx', last_modified: '2026-01-20T18:26:33' },
      ]);
      assert.strictEqual(chosen?.url, 'https://x/2025.csv');
    });

    it('returns null when no CSV resource exists', () => {
      const chosen = pickLatestResource([
        { name: 'REFES 2026', format: 'XLSX', url: 'https://x/2026.xlsx', last_modified: '2026-01-20T18:26:33' },
      ]);
      assert.strictEqual(chosen, null);
    });
  });

  describe('applyEstablishments', () => {
    const base = {
      province: null, provinceId: null, department: null, departmentId: null,
      city: null, cityId: null, postalCode: null, address: null, website: null,
      financing: null, typologyId: null, typologyAcronym: null, typologyName: null,
      longitude: null, latitude: null,
    };

    beforeEach(async () => {
      await app.service('refes-establishments').remove(null, { query: {} });
    });

    after(async () => {
      await app.service('refes-establishments').remove(null, { query: {} });
    });

    it('upserts new establishments and updates existing ones', async () => {
      await applyEstablishments(app, [{ ...base, id: 'e-1', name: 'OLD NAME' }]);
      const result = await applyEstablishments(app, [
        { ...base, id: 'e-1', name: 'NEW NAME' },
        { ...base, id: 'e-2', name: 'ANOTHER' },
      ]);

      assert.strictEqual(result.upserted, 2);
      const updated = await app.service('refes-establishments').get('e-1');
      assert.strictEqual(updated.name, 'NEW NAME');
      assert.strictEqual(updated.isActive, true);
    });

    it('deactivates establishments missing from the new dump instead of deleting them', async () => {
      await applyEstablishments(app, [
        { ...base, id: 'e-1', name: 'STAYS' },
        { ...base, id: 'e-closed', name: 'CLOSED DOWN' },
      ]);

      const result = await applyEstablishments(
        app,
        [{ ...base, id: 'e-1', name: 'STAYS' }],
        new Date(Date.now() + 1000)
      );

      assert.strictEqual(result.deactivated, 1);
      // Still resolvable by id (referenced orgs keep their labels)...
      const closed = await app.service('refes-establishments').get('e-closed');
      assert.strictEqual(closed.isActive, false);
      // ...but reactivation works if it reappears in a later dump
      await applyEstablishments(
        app,
        [{ ...base, id: 'e-1', name: 'STAYS' }, { ...base, id: 'e-closed', name: 'REOPENED' }],
        new Date(Date.now() + 2000)
      );
      const reopened = await app.service('refes-establishments').get('e-closed');
      assert.strictEqual(reopened.isActive, true);
      assert.strictEqual(reopened.name, 'REOPENED');
    });
  });
});
