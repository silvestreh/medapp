import assert from 'assert';
import app from '../../src/app';
import { Sequelize, QueryTypes } from 'sequelize';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { computeEncounterHash } from '../../src/services/encounters/hooks/encounter-hash';

describe('\'encounters\' service', () => {
  let medic: any;
  let patient: any;
  let prepaga: any;

  before(async () => {
    const suffix = Date.now().toString(36);
    const org = await createTestOrganization();
    medic = await createTestUser({
      username: `test.medic.encounter.${suffix}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    patient = await app.service('patients').create({
      medicare: `TEST123-${suffix}`,
      medicareNumber: `12345-${suffix}`
    });

    prepaga = await app.service('prepagas').create({
      shortName: `TEST-OS-${suffix}`,
      denomination: 'Test Obra Social'
    });
  });

  it('registered the service', () => {
    const service = app.service('encounters');
    assert.ok(service, 'Registered the service');
  });

  it('encrypts data before saving to the database', async () => {
    const service = app.service('encounters');
    const formData = {
      clinicalNotes: {
        values: {
          notes: 'Sensitive information',
          diagnosis: 'type 2 diabetes'
        }
      }
    };
    const testData = {
      data: formData,
      date: new Date(),
      medicId: medic.id,
      patientId: patient.id
    };

    const createdRecord = await service.create(testData);
    const sequelizeClient: Sequelize = app.get('sequelizeClient');
    const [result] = await sequelizeClient.query<{ data: Buffer }>(
      `SELECT data FROM encounters WHERE id = '${createdRecord.id}'`,
      { type: QueryTypes.SELECT }
    );

    assert.notStrictEqual(
      result.data.toString(),
      JSON.stringify(formData),
      'Data should be encrypted in the database'
    );
  });

  it('decrypts data when retrieving from the database', async () => {
    const service = app.service('encounters');
    const formData = {
      clinicalNotes: {
        values: {
          notes: 'Sensitive information',
          diagnosis: 'type 2 diabetes'
        }
      }
    };
    const testData = {
      data: formData,
      date: new Date(),
      medicId: medic.id,
      patientId: patient.id
    };

    const createdRecord = await service.create(testData);
    const retrievedRecord = await service.get(createdRecord.id);

    assert.deepStrictEqual(
      retrievedRecord.data,
      formData,
    );
  });

  it('stores insurerId for accounting', async () => {
    const service = app.service('encounters');
    const createdRecord = await service.create({
      data: { simple: { values: { note: 'Accounting check' } } },
      date: new Date(),
      medicId: medic.id,
      patientId: patient.id,
      insurerId: prepaga.id,
    } as any);

    const retrieved = await service.get(createdRecord.id);
    assert.strictEqual(retrieved.insurerId, prepaga.id);
    assert.strictEqual((retrieved as any).cost, undefined);
  });

  describe('hash chain', () => {
    const createPatient = async () => {
      const s = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return app.service('patients').create({
        medicare: `HC-${s}`,
        medicareNumber: `HC-${s}`
      });
    };

    it('computes hash on create', async () => {
      const service = app.service('encounters');
      const p = await createPatient();
      const created = await service.create({
        data: { notes: { values: { text: 'Hash test' } } },
        date: new Date(),
        medicId: medic.id,
        patientId: p.id,
      });

      assert.ok(created.hash, 'Hash should be set');
      assert.strictEqual(created.hash.length, 64, 'Hash should be 64-char hex SHA-256');
      assert.strictEqual(created.previousEncounterId, null, 'First encounter should have no previous');
    });

    it('links encounters in a chain', async () => {
      const service = app.service('encounters');
      const p = await createPatient();

      const first = await service.create({
        data: { notes: { values: { text: 'Chain first' } } },
        date: new Date('2025-01-01'),
        medicId: medic.id,
        patientId: p.id,
      });

      const second = await service.create({
        data: { notes: { values: { text: 'Chain second' } } },
        date: new Date('2025-01-02'),
        medicId: medic.id,
        patientId: p.id,
      });

      assert.ok(second.hash, 'Second encounter should have a hash');
      assert.strictEqual(second.previousEncounterId, first.id, 'Should link to previous encounter');
      assert.notStrictEqual(second.hash, first.hash, 'Hashes should differ');
    });

    it('produces deterministic hashes', async () => {
      const service = app.service('encounters');
      const p = await createPatient();

      const created = await service.create({
        data: { notes: { values: { text: 'Deterministic test' } } },
        date: new Date('2025-06-01T10:00:00Z'),
        medicId: medic.id,
        patientId: p.id,
      });

      const retrieved = await service.get(created.id);

      // Genesis encounter: no previous hash
      const expectedHash = computeEncounterHash(retrieved, null);
      assert.strictEqual(retrieved.hash, expectedHash, 'Hash should be deterministic');
    });

    it('keeps independent chains per patient', async () => {
      const service = app.service('encounters');
      const p1 = await createPatient();
      const p2 = await createPatient();

      const enc1 = await service.create({
        data: { notes: { values: { text: 'Patient A' } } },
        date: new Date('2025-03-01'),
        medicId: medic.id,
        patientId: p1.id,
      });

      const enc2 = await service.create({
        data: { notes: { values: { text: 'Patient B' } } },
        date: new Date('2025-03-01'),
        medicId: medic.id,
        patientId: p2.id,
      });

      // enc2 should NOT reference enc1 since they're different patients
      assert.notStrictEqual(enc2.previousEncounterId, enc1.id, 'Chains should be independent per patient');
    });

    it('marks encounters as not tampered on read', async () => {
      const service = app.service('encounters');
      const p = await createPatient();

      const created = await service.create({
        data: { notes: { values: { text: 'Tamper check' } } },
        date: new Date(),
        medicId: medic.id,
        patientId: p.id,
      });

      const retrieved = await service.get(created.id);
      assert.strictEqual(retrieved.tampered, false, 'Valid encounter should not be marked as tampered');
    });

    it('detects tampered encounters on read', async () => {
      const service = app.service('encounters');
      const sequelizeClient: Sequelize = app.get('sequelizeClient');
      const p = await createPatient();

      const created = await service.create({
        data: { notes: { values: { text: 'Original data' } } },
        date: new Date(),
        medicId: medic.id,
        patientId: p.id,
      });

      // Tamper with the data directly in the DB (update the encrypted blob)
      const tamperedData = JSON.stringify({ notes: { values: { text: 'TAMPERED!' } } });
      const encryptionKey = process.env.ENCRYPTION_KEY;
      await sequelizeClient.query(
        'UPDATE encounters SET data = PGP_SYM_ENCRYPT(:data, :key) WHERE id = :id',
        {
          replacements: { data: tamperedData, key: encryptionKey, id: created.id }
        }
      );

      const retrieved = await service.get(created.id);
      assert.strictEqual(retrieved.tampered, true, 'Tampered encounter should be detected');
    });
  });
});
