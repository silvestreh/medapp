import assert from 'assert';
import app from '../../src/app';
import { Sequelize, QueryTypes } from 'sequelize';

describe('\'encounters\' service', () => {
  let medic: any;
  let patient: any;

  before(async () => {
    medic = await app.service('users').create({
      username: 'test.medic.encounter',
      password: 'SuperSecret1',
      roleId: 'medic'
    });

    patient = await app.service('patients').create({
      medicare: 'TEST123',
      medicareNumber: '12345'
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
});
