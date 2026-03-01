import assert from 'assert';
import app from '../../src/app';
import { Sequelize, QueryTypes } from 'sequelize';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'encounters\' service', () => {
  let medic: any;
  let patient: any;
  let prepaga: any;

  before(async () => {
    const org = await createTestOrganization();
    medic = await createTestUser({
      username: 'test.medic.encounter',
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    patient = await app.service('patients').create({
      medicare: 'TEST123',
      medicareNumber: '12345'
    });

    prepaga = await app.service('prepagas').create({
      shortName: 'TEST-OS',
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
});
