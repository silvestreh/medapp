import assert from 'assert';
import { mapPractitioner } from '../../mappers/practitioner.mapper';

describe('Practitioner Mapper', () => {
  const basePractitioner = {
    id: 'user-uuid-456',
    personal_data: [{
      firstName: 'María',
      lastName: 'González',
      documentType: 'DNI',
      documentValue: '28654321',
      gender: 'female',
      birthDate: '1985-03-10',
    }],
    md_setting: {
      medicalSpecialty: 'Cardiología',
      nationalLicenseNumber: 'MN-12345',
      stateLicense: 'CABA',
      stateLicenseNumber: 'MP-67890',
      title: 'Dra.',
      isVerified: true,
    },
  };

  it('should map a complete practitioner to Practitioner-ar-core', () => {
    const result = mapPractitioner(basePractitioner);

    assert.strictEqual(result.resourceType, 'Practitioner');
    assert.strictEqual(result.id, 'user-uuid-456');
    assert.strictEqual(result.active, true);
    assert.strictEqual(result.gender, 'female');
    assert.strictEqual(result.birthDate, '1985-03-10');
  });

  it('should include AR.FHIR.CORE profile', () => {
    const result = mapPractitioner(basePractitioner);
    assert.ok(result.meta?.profile?.includes('http://fhir.msal.gob.ar/core/StructureDefinition/Practitioner-ar-core'));
  });

  it('should have DNI, REFEPS, and domain identifiers', () => {
    const result = mapPractitioner(basePractitioner);
    assert.strictEqual(result.identifier?.length, 3);

    const dni = result.identifier![0];
    assert.strictEqual(dni.system, 'http://www.renaper.gob.ar/dni');
    assert.strictEqual(dni.value, '28654321');
    assert.strictEqual(dni.assigner?.display, 'RENAPER');

    const refeps = result.identifier![1];
    assert.strictEqual(refeps.system, 'http://refeps.msal.gob.ar');
    assert.strictEqual(refeps.value, 'MN-12345');
    assert.strictEqual(refeps.type?.coding?.[0].code, 'AC');
  });

  it('should include title as prefix', () => {
    const result = mapPractitioner(basePractitioner);
    assert.deepStrictEqual(result.name?.[0].prefix, ['Dra.']);
  });

  it('should include specialty and state license in qualifications', () => {
    const result = mapPractitioner(basePractitioner);
    assert.strictEqual(result.qualification?.length, 2);
    assert.strictEqual(result.qualification![0].code.text, 'Cardiología');
    assert.strictEqual(result.qualification![1].code.text, 'CABA License');
    assert.strictEqual(result.qualification![1].identifier?.[0].value, 'MP-67890');
  });

  it('should handle practitioner without md_setting', () => {
    const noSettings = {
      id: 'user-uuid-789',
      personal_data: basePractitioner.personal_data,
    };
    const result = mapPractitioner(noSettings);
    assert.strictEqual(result.qualification, undefined);
    // Only DNI + domain (no REFEPS)
    assert.strictEqual(result.identifier?.length, 2);
  });

  it('should handle practitioner without personal_data', () => {
    const noPd = { id: 'user-uuid-000' };
    const result = mapPractitioner(noPd);
    assert.strictEqual(result.resourceType, 'Practitioner');
    assert.strictEqual(result.identifier, undefined);
  });
});
