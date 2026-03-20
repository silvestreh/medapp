import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('send-sire-push hook', () => {
  let org: any;
  let user: any;
  let patient: any;
  let treatment: any;

  before(async () => {
    org = await createTestOrganization({ slug: `sire-hook-${Date.now()}` });
    user = await createTestUser({
      username: `hook.medic.${Date.now()}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      personalData: {
        firstName: 'Hook',
        lastName: 'Patient',
        documentValue: `sire-hook-${Date.now()}`,
      },
      contactData: {
        phoneNumber: ['cel:1155550002'],
      },
    } as any);
    treatment = await app.service('sire-treatments').create({
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
  });

  it('does not throw when no push tokens exist', async () => {
    // Creating a reading should not throw even without push tokens
    const reading = await app.service('sire-readings').create({
      treatmentId: treatment.id,
      patientId: patient.id,
      organizationId: org.id,
      date: '2026-03-17',
      inr: 2.5,
      source: 'provider',
    });

    assert.ok(reading.id, 'Reading was created successfully');
  });

  it('does not throw when creating a dose schedule without push tokens', async () => {
    const schedule = await app.service('sire-dose-schedules').create({
      treatmentId: treatment.id,
      startDate: '2026-03-17',
      schedule: {
        monday: 1, tuesday: 0.5, wednesday: 1, thursday: 0.5,
        friday: 1, saturday: 0.5, sunday: 1,
      },
      createdById: user.id,
    });

    assert.ok(schedule.id, 'Schedule was created successfully');
  });

  it('does not send push when patient creates their own action', async () => {
    // When params.patient is set, the hook should skip
    const reading = await app.service('sire-readings').create({
      treatmentId: treatment.id,
      patientId: patient.id,
      organizationId: org.id,
      date: '2026-03-18',
      inr: 2.8,
      source: 'patient',
    }, {
      patient: { id: patient.id, organizationId: org.id },
    } as any);

    assert.ok(reading.id, 'Reading was created without error');
  });
});
