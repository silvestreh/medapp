import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'sire-dose-schedules\' service', () => {
  let org: any;
  let user: any;
  let patient: any;
  let treatmentId: string;

  before(async () => {
    org = await createTestOrganization({ slug: `sire-dose-${Date.now()}` });
    user = await createTestUser({
      username: `dose.medic.${Date.now()}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      personalData: {
        firstName: 'Dose',
        lastName: 'Patient',
        documentValue: `sire-dose-${Date.now()}`,
      },
      contactData: {
        phoneNumber: ['cel:1155550002'],
      },
    } as any);

    const treatment: any = await app.service('sire-treatments').create({
      patientId: patient.id,
      organizationId: org.id,
      medicId: user.id,
      medication: 'Acenocumarol',
      tabletDoseMg: 4,
      targetInrMin: 2.0,
      targetInrMax: 3.0,
      startDate: '2026-03-01',
      status: 'active',
    });
    treatmentId = String(treatment.id);
  });

  it('registered the service', () => {
    const service = app.service('sire-dose-schedules');
    assert.ok(service, 'Registered the service');
  });

  it('creates a dose schedule with tablet fractions', async () => {
    const schedule: any = await app.service('sire-dose-schedules').create({
      treatmentId,
      startDate: '2026-03-10',
      schedule: {
        monday: 0.5,
        tuesday: 0.25,
        wednesday: 0.5,
        thursday: 0.25,
        friday: 0.25,
        saturday: 0.5,
        sunday: null,
      },
      createdById: user.id,
    });

    assert.ok(schedule.id, 'Schedule has an ID');
    assert.strictEqual(schedule.schedule.monday, 0.5);
    assert.strictEqual(schedule.schedule.tuesday, 0.25);
    assert.strictEqual(schedule.schedule.sunday, null);
  });

  it('finds schedules by treatmentId', async () => {
    const result: any = await app.service('sire-dose-schedules').find({
      query: { treatmentId },
    });

    const schedules = result.data || result;
    assert.ok(schedules.length > 0, 'Should find at least one schedule');
  });

  it('finds schedules with a patient token scoped to their own treatment', async () => {
    const result: any = await app.service('sire-dose-schedules').find({
      query: {
        treatmentId,
        $sort: { startDate: -1, createdAt: -1 },
        $limit: 1,
      },
      patient: { id: String(patient.id) },
    } as any);

    const schedules = result.data || result;
    assert.ok(schedules.length > 0, 'Patient should find schedules for their own treatment');
    assert.strictEqual(schedules[0].treatmentId, treatmentId);
  });

  it('finds only own schedules with a patient token and no treatmentId filter', async () => {
    const result: any = await app.service('sire-dose-schedules').find({
      query: {},
      patient: { id: String(patient.id) },
    } as any);

    const schedules = result.data || result;
    assert.ok(schedules.length > 0, 'Patient should find their own schedules');
    schedules.forEach((schedule: any) => {
      assert.strictEqual(schedule.treatmentId, treatmentId);
    });
  });

  it('rejects a patient find for another patient\'s treatment', async () => {
    await assert.rejects(
      app.service('sire-dose-schedules').find({
        query: { treatmentId },
        patient: { id: 'some-other-patient-id' },
      } as any),
      /Cannot access schedules/
    );
  });

  it('allows a patient to get their own schedule', async () => {
    const created: any = await app.service('sire-dose-schedules').create({
      treatmentId,
      startDate: '2026-04-01',
      schedule: {
        monday: 0.5,
        tuesday: 0.5,
        wednesday: 0.5,
        thursday: 0.5,
        friday: 0.5,
        saturday: 0.5,
        sunday: null,
      },
      createdById: user.id,
    });

    const fetched: any = await app.service('sire-dose-schedules').get(created.id, {
      patient: { id: String(patient.id) },
    } as any);

    assert.strictEqual(fetched.id, created.id);
  });

  it('blocks a patient from getting another patient\'s schedule', async () => {
    const created: any = await app.service('sire-dose-schedules').create({
      treatmentId,
      startDate: '2026-04-05',
      schedule: {
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 1,
        sunday: null,
      },
      createdById: user.id,
    });

    await assert.rejects(
      app.service('sire-dose-schedules').get(created.id, {
        patient: { id: 'some-other-patient-id' },
      } as any),
      /No record found/
    );
  });

  it('patches a schedule to close it with an endDate', async () => {
    const schedule: any = await app.service('sire-dose-schedules').create({
      treatmentId,
      startDate: '2026-03-15',
      schedule: {
        monday: 1,
        tuesday: 0.5,
        wednesday: 1,
        thursday: 0.5,
        friday: 0.5,
        saturday: 1,
        sunday: null,
      },
      createdById: user.id,
    });

    const patched: any = await app.service('sire-dose-schedules').patch(schedule.id, {
      endDate: '2026-03-20',
    });

    assert.strictEqual(patched.endDate, '2026-03-20');
  });
});
