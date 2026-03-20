import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'sire-dose-logs\' service', () => {
  let org: any;
  let user: any;
  let patient: any;
  let treatmentId: string;

  before(async () => {
    org = await createTestOrganization({ slug: `sire-log-${Date.now()}` });
    user = await createTestUser({
      username: `log.medic.${Date.now()}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      personalData: {
        firstName: 'Log',
        lastName: 'Patient',
        documentValue: `sire-log-${Date.now()}`,
      },
      contactData: {
        phoneNumber: ['cel:1155550003'],
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
    const service = app.service('sire-dose-logs');
    assert.ok(service, 'Registered the service');
  });

  it('logs a taken dose', async () => {
    const log: any = await app.service('sire-dose-logs').create({
      treatmentId,
      patientId: patient.id,
      date: '2026-03-16',
      taken: true,
      expectedDose: 0.5,
    });

    assert.ok(log.id, 'Log has an ID');
    assert.strictEqual(log.taken, true);
    assert.strictEqual(log.expectedDose, 0.5);
  });

  it('logs a not-taken dose', async () => {
    const log: any = await app.service('sire-dose-logs').create({
      treatmentId,
      patientId: patient.id,
      date: '2026-03-17',
      taken: false,
      expectedDose: 0.25,
    });

    assert.ok(log.id);
    assert.strictEqual(log.taken, false);
  });

  it('finds logs by patientId and date', async () => {
    const result: any = await app.service('sire-dose-logs').find({
      query: { patientId: patient.id, date: '2026-03-16' },
    });

    const logs = result.data || result;
    assert.ok(logs.length > 0, 'Should find the log');
    assert.strictEqual(logs[0].taken, true);
  });
});
