import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'sire-readings\' service', () => {
  let org: any;
  let user: any;
  let patient: any;
  let treatmentId: string;

  before(async () => {
    org = await createTestOrganization({ slug: `sire-read-${Date.now()}` });
    user = await createTestUser({
      username: `read.medic.${Date.now()}@test.com`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      personalData: {
        firstName: 'Reading',
        lastName: 'Patient',
        documentValue: `sire-read-${Date.now()}`,
      },
      contactData: {
        phoneNumber: ['cel:1155550001'],
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
    const service = app.service('sire-readings');
    assert.ok(service, 'Registered the service');
  });

  it('creates a reading with INR, quick, and percentage', async () => {
    const reading: any = await app.service('sire-readings').create({
      treatmentId,
      patientId: patient.id,
      organizationId: org.id,
      date: '2026-03-10',
      inr: 2.4,
      quick: 1.2,
      percentage: 48,
      source: 'provider',
    });

    assert.ok(reading.id, 'Reading has an ID');
    assert.strictEqual(reading.inr, 2.4);
    assert.strictEqual(reading.quick, 1.2);
    assert.strictEqual(reading.percentage, 48);
    assert.strictEqual(reading.source, 'provider');
  });

  it('finds readings by treatmentId', async () => {
    const result: any = await app.service('sire-readings').find({
      query: { treatmentId },
    });

    const readings = result.data || result;
    assert.ok(readings.length > 0, 'Should find at least one reading');
    assert.strictEqual(readings[0].treatmentId, treatmentId);
  });

  it('creates a reading with only INR (quick and percentage optional)', async () => {
    const reading: any = await app.service('sire-readings').create({
      treatmentId,
      patientId: patient.id,
      organizationId: org.id,
      date: '2026-03-11',
      inr: 3.1,
      source: 'lab',
    });

    assert.ok(reading.id);
    assert.strictEqual(reading.inr, 3.1);
    assert.strictEqual(reading.quick, null);
    assert.strictEqual(reading.percentage, null);
  });
});
