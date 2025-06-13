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

  it('can find by personal data', async () => {
    const [patient] = await app.service('patients').find({
      query: {
        documentValue: '1234567890'
      },
      paginate: false
    });
    const { data: [paginatedPatient] } = await app.service('patients').find({
      query: {
        documentValue: '1234567890'
      }
    });

    assert.equal(patient.personalData.documentValue, '1234567890');
    assert.equal(paginatedPatient.personalData.documentValue, '1234567890');
  });
});
