import assert from 'assert';
import app from '../../src/app';
import { Patient, User, Study, StudyResult } from '../../src/declarations';

describe('\'study-results\' service', () => {
  let medic: User;
  let patient: Patient;
  let study: Study;
  let result: StudyResult;

  before(async () => {
    await app.service('roles').create({
      id: 'medic',
      permissions: ['studies:create', 'studies:patch', 'studies:get', 'studies:find']
    }).catch(() => null);

    medic = await app.service('users').create({
      username: 'medic-study-results',
      password: 'password123',
      roleId: 'medic'
    });

    patient = await app.service('patients').create({
      medicare: 'medicare-study-results',
      medicareNumber: '123456789',
      medicarePlan: 'planA'
    }) as Patient;

    study = await app.service('studies').create({
      date: new Date(),
      studies: ['anemia'],
      noOrder: false,
      medicId: medic.id,
      patientId: patient.id
    });

    result = await app.service('study-results').create({
      data: { value: 'initial' },
      studyId: study.id,
      type: 'anemia'
    });
  });

  it('registered the service', () => {
    const service = app.service('study-results');

    assert.ok(service, 'Registered the service');
  });

  it('disallows external create', async () => {
    await assert.rejects(() => app.service('study-results').create({
      data: { value: 'blocked' },
      studyId: study.id,
      type: 'hemostasis'
    }, { provider: 'rest' } as any));
  });

  it('disallows external patch', async () => {
    await assert.rejects(() => app.service('study-results').patch(result.id, {
      data: { value: 'blocked-patch' }
    }, { provider: 'rest' } as any));
  });
});
