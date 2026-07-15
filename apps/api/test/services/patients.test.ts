import assert from 'assert';
import app from '../../src/app';

describe('\'patients\' service', () => {
  it('registered the service', () => {
    const service = app.service('patients');
    assert.ok(service, 'Registered the service');
  });

  it('includes personal and contact data in the patient result', async () => {
    const patient = await app.service('patients').create({
      medicare: 'OSDE',
      personalData: {
        firstName: 'John',
        lastName: 'Doe',
        documentValue: '1234567890'
      },
      contactData: {
        email: 'john.doe@example.com',
        phoneNumber: ['tel:1234567890', 'cel:4445556666']
      }
    });
    const getPatient = await app.service('patients').get(patient.id);

    assert.ok(getPatient.personalData, 'Includes personal data');
    assert.ok(getPatient.contactData, 'Includes contact data');
  });

  it('creates and links contact data when patching a patient without one', async () => {
    const patient = await app.service('patients').create({
      personalData: {
        firstName: 'Jane',
        lastName: 'Smith',
        documentValue: '9876543210'
      }
    });

    const before = await app.service('patients').get(patient.id);
    assert.ok(!before.contactData, 'Patient starts without contact data');

    await app.service('patients').patch(patient.id, {
      contactData: {
        email: 'jane.smith@example.com',
        city: 'La Plata'
      }
    });

    const after = await app.service('patients').get(patient.id);
    assert.ok(after.contactData, 'Contact data was created');
    assert.equal(after.contactData.email, 'jane.smith@example.com');
    assert.equal(after.contactData.city, 'La Plata');
  });

  it('patches existing contact data through patients.patch', async () => {
    const patient = await app.service('patients').create({
      personalData: {
        firstName: 'Mario',
        lastName: 'Rossi',
        documentValue: '5556667770'
      },
      contactData: {
        email: 'mario.rossi@example.com',
        city: 'CABA'
      }
    });

    await app.service('patients').patch(patient.id, {
      contactData: {
        city: 'Rosario'
      }
    });

    const after = await app.service('patients').get(patient.id);
    assert.equal(after.contactData.city, 'Rosario', 'Patched field updated');
    assert.equal(after.contactData.email, 'mario.rossi@example.com', 'Untouched field preserved');
  });

  it('can find by personal data', async () => {
    const result: any = await app.service('patients').find({
      query: {
        documentValue: '1234567890'
      }
    });
    const patients = result.data || result;
    const patient = patients[0];

    assert.ok(patient, 'Found a patient');
    assert.equal(patient.personalData.documentValue, '1234567890');
  });
});
