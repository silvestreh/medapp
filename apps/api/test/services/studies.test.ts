import assert from 'assert';
import app from '../../src/app';
import { Study, StudyResult, User, Patient } from '../../src/declarations';

describe('\'studies\' service', () => {
  let medic: User;
  let patient: Patient;
  let study: Study;

  before(async () => {
    await app.service('roles').create({
      id: 'medic',
      permissions: ['studies:create', 'studies:patch', 'studies:get', 'studies:find']
    }).catch(() => null);

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

  it('creates nested results through studies.create()', async () => {
    const created = await app.service('studies').create({
      date: new Date(),
      studies: ['anemia', 'hemostasis'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
      results: [
        { type: 'anemia', data: { value: '11' } },
        { type: 'hemostasis', data: { value: 'normal' } }
      ]
    } as any);

    const saved = await app.service('studies').get(created.id);

    assert.ok(saved.results, 'Results are populated');
    assert.strictEqual(saved.results!.length, 2, 'Two nested results were created');
    assert.deepStrictEqual(
      saved.results!.map((r: StudyResult) => r.type).sort(),
      ['anemia', 'hemostasis'],
      'Created result types match payload'
    );
  });

  it('upserts nested results through studies.patch()', async () => {
    const created = await app.service('studies').create({
      date: new Date(),
      studies: ['anemia'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
      results: [
        { type: 'anemia', data: { value: 'old' } }
      ]
    } as any);

    await app.service('studies').patch(created.id, {
      results: [
        { type: 'anemia', data: { value: 'new' } },
        { type: 'thrombophilia', data: { value: 'added' } }
      ]
    } as any);

    const saved = await app.service('studies').get(created.id);
    const anemia = saved.results!.find((r: StudyResult) => r.type === 'anemia');
    const thrombophilia = saved.results!.find((r: StudyResult) => r.type === 'thrombophilia');

    assert.ok(anemia, 'Existing result was kept');
    assert.deepStrictEqual(anemia!.data, { value: 'new' }, 'Existing result was updated');
    assert.ok(thrombophilia, 'Missing result type was created');
    assert.deepStrictEqual(thrombophilia!.data, { value: 'added' }, 'New result has expected payload');
  });
});
