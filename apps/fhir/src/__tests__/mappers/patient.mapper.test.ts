import assert from 'assert';
import { mapPatient } from '../../mappers/patient.mapper';

describe('Patient Mapper', () => {
  const basePatient = {
    id: 'patient-uuid-123',
    deleted: false,
    medicare: 'OSDE',
    medicareNumber: '12345',
    medicarePlan: '310',
    personal_data: [{
      firstName: 'Pablo',
      lastName: 'Fernández',
      nationality: 'AR',
      documentType: 'DNI',
      documentValue: '30123456',
      maritalStatus: 'married',
      birthDate: '1990-05-15',
      gender: 'male',
    }],
    contact_data: [{
      streetAddress: 'Av. Corrientes 1234',
      country: 'AR',
      city: 'Buenos Aires',
      province: 'CABA',
      phoneNumber: '+5491112345678',
      email: 'pablo@example.com',
    }],
  };

  it('should map a complete patient to Patient-ar-core', () => {
    const result = mapPatient(basePatient);

    assert.strictEqual(result.resourceType, 'Patient');
    assert.strictEqual(result.id, 'patient-uuid-123');
    assert.strictEqual(result.active, true);
    assert.strictEqual(result.gender, 'male');
    assert.strictEqual(result.birthDate, '1990-05-15');
  });

  it('should include AR.FHIR.CORE profile', () => {
    const result = mapPatient(basePatient);
    assert.ok(result.meta?.profile?.includes('http://fhir.msal.gob.ar/core/StructureDefinition/Patient-ar-core'));
  });

  it('should have 2 mandatory identifiers (DocumentoUnico + IdentificadorDominio)', () => {
    const result = mapPatient(basePatient);
    assert.strictEqual(result.identifier?.length, 2);

    const dni = result.identifier![0];
    assert.strictEqual(dni.use, 'official');
    assert.strictEqual(dni.system, 'http://www.renaper.gob.ar/dni');
    assert.strictEqual(dni.value, '30123456');

    const domain = result.identifier![1];
    assert.strictEqual(domain.use, 'usual');
    assert.strictEqual(domain.value, 'patient-uuid-123');
  });

  it('should build official name with fathers-family extension', () => {
    const result = mapPatient(basePatient);
    assert.strictEqual(result.name?.length, 1);

    const name = result.name![0];
    assert.strictEqual(name.use, 'official');
    assert.strictEqual(name.family, 'Fernández');
    assert.deepStrictEqual(name.given, ['Pablo']);
  });

  it('should map telecom contacts', () => {
    const result = mapPatient(basePatient);
    assert.strictEqual(result.telecom?.length, 2);

    const phone = result.telecom![0];
    assert.strictEqual(phone.system, 'phone');
    assert.strictEqual(phone.value, '+5491112345678');

    const email = result.telecom![1];
    assert.strictEqual(email.system, 'email');
    assert.strictEqual(email.value, 'pablo@example.com');
  });

  it('should map address', () => {
    const result = mapPatient(basePatient);
    assert.strictEqual(result.address?.length, 1);
    assert.strictEqual(result.address![0].city, 'Buenos Aires');
    assert.strictEqual(result.address![0].state, 'CABA');
  });

  it('should map marital status', () => {
    const result = mapPatient(basePatient);
    assert.strictEqual(result.maritalStatus?.coding?.[0].code, 'M');
  });

  it('should handle deleted patient', () => {
    const deleted = { ...basePatient, deleted: true };
    const result = mapPatient(deleted);
    assert.strictEqual(result.active, false);
  });

  it('should handle patient without personal data', () => {
    const minimal = { id: 'min-uuid', deleted: false };
    const result = mapPatient(minimal);
    assert.strictEqual(result.resourceType, 'Patient');
    assert.strictEqual(result.id, 'min-uuid');
    assert.strictEqual(result.identifier, undefined);
  });

  it('should use NI type for non-AR documents', () => {
    const foreign = {
      ...basePatient,
      personal_data: [{
        ...basePatient.personal_data[0],
        nationality: 'BR',
        documentType: 'CPF',
        documentValue: '12345678900',
      }],
    };
    const result = mapPatient(foreign);
    const doc = result.identifier![0];
    assert.strictEqual(doc.use, 'official');
    assert.strictEqual(doc.type?.text, 'CPF');
  });

  it('should map passport with PPN type and mininterior system', () => {
    const passportPatient = {
      ...basePatient,
      personal_data: [{
        ...basePatient.personal_data[0],
        documentType: 'passport',
        documentValue: 'AAB123456',
      }],
    };
    const result = mapPatient(passportPatient);
    const doc = result.identifier![0];
    assert.strictEqual(doc.system, 'http://www.mininterior.gob.ar/pas');
    assert.strictEqual(doc.type?.coding?.[0].code, 'PPN');
    assert.strictEqual(doc.value, 'AAB123456');
  });

  it('should map Libreta de Enrolamiento (LE)', () => {
    const lePatient = {
      ...basePatient,
      personal_data: [{
        ...basePatient.personal_data[0],
        documentType: 'LE',
        documentValue: '5678901',
      }],
    };
    const result = mapPatient(lePatient);
    const doc = result.identifier![0];
    assert.strictEqual(doc.system, 'http://www.renaper.gob.ar/dni');
    assert.strictEqual(doc.type?.text, 'Libreta de Enrolamiento');
    assert.strictEqual(doc.value, '5678901');
  });

  it('should map Libreta Cívica (LC)', () => {
    const lcPatient = {
      ...basePatient,
      personal_data: [{
        ...basePatient.personal_data[0],
        documentType: 'LC',
        documentValue: '3456789',
      }],
    };
    const result = mapPatient(lcPatient);
    const doc = result.identifier![0];
    assert.strictEqual(doc.system, 'http://www.renaper.gob.ar/dni');
    assert.strictEqual(doc.type?.text, 'Libreta Cívica');
  });

  it('should map Cédula de Identidad (CI) without RENAPER system', () => {
    const ciPatient = {
      ...basePatient,
      personal_data: [{
        ...basePatient.personal_data[0],
        documentType: 'CI',
        documentValue: '9876543',
      }],
    };
    const result = mapPatient(ciPatient);
    const doc = result.identifier![0];
    assert.strictEqual(doc.system, undefined);
    assert.strictEqual(doc.type?.text, 'Cédula de Identidad');
  });
});
