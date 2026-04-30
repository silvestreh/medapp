import assert from 'assert';
import app from '../../src/app';
import { Study, StudyResult, User, Patient } from '../../src/declarations';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { getUserPermissions } from '../../src/utils/get-user-permissions';

describe('\'studies\' service', () => {
  let medic: User;
  let patient: Patient;
  let study: Study;
  let prepaga: any;
  let org: any;

  before(async () => {
    await app.service('roles').create({
      id: 'medic',
      permissions: ['studies:create', 'studies:patch', 'studies:get', 'studies:find']
    }).catch(() => null);

    org = await createTestOrganization();
    medic = await createTestUser({
      username: 'medic1',
      password: 'Password123!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    await app.service('md-settings').create({
      userId: medic.id,
      encounterDuration: 20,
      isVerified: true,
    });

    patient = await app.service('patients').create({
      medicare: 'medicare123',
      medicareNumber: '123456789',
      medicarePlan: 'planA',
    }) as Patient;

    prepaga = await app.service('prepagas').create({
      shortName: 'TEST-OS-STUDY',
      denomination: 'Test Obra Social Study'
    });

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

  describe('searchStudies hook', () => {
    it('finds a study by patient documentValue', async () => {
      const testPatient = await app.service('patients').create({
        medicare: 'medicare-search-test',
        medicareNumber: '999999999',
        medicarePlan: 'planB',
        personalData: {
          documentType: 'DNI',
          documentValue: '12345678',
          firstName: 'Test',
          lastName: 'SearchPatient',
        },
      } as any) as Patient;

      const testStudy = await app.service('studies').create({
        date: new Date(),
        studies: ['anemia'],
        noOrder: false,
        medicId: medic.id,
        patientId: testPatient.id,
      });

      const result = await app.service('studies').find({
        query: { q: '12345678' },
      });

      const ids = result.data.map((s: Study) => s.id);
      assert.ok(ids.includes(testStudy.id), 'Study found by patient documentValue');
    });

    it('finds a study by protocol when no documentValue matches', async () => {
      const result = await app.service('studies').find({
        query: { q: String(study.protocol) },
      });

      const ids = result.data.map((s: Study) => s.id);
      assert.ok(ids.includes(study.id), 'Study found by protocol number');
    });

    it('finds studies by both documentValue and protocol', async () => {
      // Create a study so we know its protocol number
      const protoStudy = await app.service('studies').create({
        date: new Date(),
        studies: ['hemostasis'],
        noOrder: false,
        medicId: medic.id,
        patientId: patient.id,
      });

      // Create a patient whose DNI matches the protocol number
      const dniPatient = await app.service('patients').create({
        medicare: 'medicare-dual-test',
        medicareNumber: '888888888',
        medicarePlan: 'planC',
        personalData: {
          documentType: 'DNI',
          documentValue: String(protoStudy.protocol),
          firstName: 'Dual',
          lastName: 'TestPatient',
        },
      } as any) as Patient;

      const dniStudy = await app.service('studies').create({
        date: new Date(),
        studies: ['anemia'],
        noOrder: false,
        medicId: medic.id,
        patientId: dniPatient.id,
      });

      // Search by the protocol number (which also matches the DNI)
      const result = await app.service('studies').find({
        query: { q: String(protoStudy.protocol) },
      });

      const ids = result.data.map((s: Study) => s.id);
      assert.ok(ids.includes(protoStudy.id), 'Study found by protocol');
      assert.ok(ids.includes(dniStudy.id), 'Study found by documentValue');
    });
  });

  describe('prevent patient change with results', () => {
    const authenticatedParams = () => ({
      provider: 'rest',
      authenticated: true,
      user: medic,
      organizationId: org.id,
    } as any);

    it('allows changing patientId when study has no results', async () => {
      const newPatient = await app.service('patients').create({
        medicare: 'medicare-reassign',
        medicareNumber: '111111111',
        medicarePlan: 'planX',
      }) as Patient;

      const emptyStudy = await app.service('studies').create({
        date: new Date(),
        studies: ['anemia'],
        noOrder: false,
        medicId: medic.id,
        patientId: patient.id,
      });

      const params = authenticatedParams();
      params.orgPermissions = await getUserPermissions(app, String(medic.id), String(org.id));

      const patched = await app.service('studies').patch(emptyStudy.id, {
        patientId: newPatient.id,
      }, params);

      assert.strictEqual(patched.patientId, newPatient.id);
    });

    it('rejects changing patientId when study has results', async () => {
      const newPatient = await app.service('patients').create({
        medicare: 'medicare-reject',
        medicareNumber: '222222222',
        medicarePlan: 'planY',
      }) as Patient;

      const params = authenticatedParams();
      params.orgPermissions = await getUserPermissions(app, String(medic.id), String(org.id));

      try {
        await app.service('studies').patch(study.id, {
          patientId: newPatient.id,
        }, params);
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.strictEqual(error.code, 400);
        assert.ok(error.message.includes('Cannot change patient'));
      }
    });

    it('allows patching other fields on a study with results', async () => {
      const params = authenticatedParams();
      params.orgPermissions = await getUserPermissions(app, String(medic.id), String(org.id));

      const patched = await app.service('studies').patch(study.id, {
        noOrder: true,
      }, params);

      assert.strictEqual(patched.noOrder, true);
    });
  });

  it('persists comment on create and patch', async () => {
    const created = await app.service('studies').create({
      date: new Date(),
      studies: ['anemia'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
      comment: 'Initial observations',
    } as any);

    let saved = await app.service('studies').get(created.id);
    assert.strictEqual(saved.comment, 'Initial observations');

    await app.service('studies').patch(created.id, {
      comment: 'Updated observations',
    } as any);

    saved = await app.service('studies').get(created.id);
    assert.strictEqual(saved.comment, 'Updated observations');
  });

  it('stores insurerId for accounting', async () => {
    const created = await app.service('studies').create({
      date: new Date(),
      studies: ['anemia', 'hemostasis'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id,
      insurerId: prepaga.id,
    } as any);

    const saved = await app.service('studies').get(created.id);
    assert.strictEqual(saved.insurerId, prepaga.id);
    assert.strictEqual((saved as any).cost, undefined);
  });
});
