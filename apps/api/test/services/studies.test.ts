import assert from 'assert';
import app from '../../src/app';
import { Study, User, Patient } from '../../src/declarations';

describe('\'studies\' service', () => {
  let medic: User;
  let patient: Patient;
  let study: Study;

  before(async () => {
    medic = await app.service('users').create({
      username: 'medic1',
      password: 'password123',
      roleId: 'medic'
    });

    patient = await app.service('patients').create({
      medicare: 'medicare123',
      medicareNumber: '123456789',
      medicarePlan: 'planA',
    }) as Patient;

    study = await app.service('studies').create({
      date: new Date(),
      protocol: 123,
      studies: ['anemia'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id
    });

    await app.service('study-results').create({
      data: { result: 'Positive' },
      studyId: study.id,
      type: 'anemia'
    });
  });

  it('registered the service', () => {
    const service = app.service('studies');
    assert.ok(service, 'Registered the service');
  });

  it('populates results on .find()', async () => {
    const query = { id: study.id };
    const result = await app.service('studies').find({ query });

    assert.ok(result.data[0].results, 'Results are populated');
    assert.strictEqual(result.data[0].results.length, 1, 'One result is populated');
    assert.deepStrictEqual(result.data[0].results[0].data, { result: 'Positive' }, 'Correct result is populated');
  });

  it('populates results on .find() without pagination', async () => {
    const query = { id: study.id };
    const result = await app.service('studies').find({ query, paginate: false });

    assert.ok(result[0].results, 'Results are populated');
    assert.strictEqual(result[0].results.length, 1, 'One result is populated');
    assert.deepStrictEqual(result[0].results[0].data, { result: 'Positive' }, 'Correct result is populated');
  });

  it('handles empty results correctly', async () => {
    const query = { id: 'bs-id' };
    const result = await app.service('studies').find({ query });

    assert.ok(result.data, 'Result has data property');
    assert.strictEqual(result.data.length, 0, 'No results returned');
    assert.deepStrictEqual(result.data, [], 'Empty array returned');
  });

  it('populates results on .get()', async () => {
    const result = await app.service('studies').get(study.id);

    assert.ok(result.results, 'Results are populated');
    assert.strictEqual(result.results.length, 1, 'One result is populated');
    assert.deepStrictEqual(result.results[0].data, { result: 'Positive' }, 'Correct result is populated');
  });
});
