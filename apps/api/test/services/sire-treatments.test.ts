import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'sire-treatments\' service', () => {
  let org: any;
  let user: any;
  let patient: any;

  before(async () => {
    org = await createTestOrganization({ slug: `sire-treat-${Date.now()}` });
    user = await createTestUser({
      username: `treat.medic.${Date.now()}@test.com`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });
    patient = await app.service('patients').create({
      personalData: {
        firstName: 'Sire',
        lastName: 'Patient',
        documentValue: `sire-treat-${Date.now()}`,
      },
      contactData: {
        phoneNumber: ['cel:1155550000'],
      },
    } as any);
  });

  it('registered the service', () => {
    const service = app.service('sire-treatments');
    assert.ok(service, 'Registered the service');
  });

  it('creates a treatment', async () => {
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

    assert.ok(treatment.id, 'Treatment has an ID');
    assert.strictEqual(treatment.medication, 'Acenocumarol');
    assert.strictEqual(treatment.tabletDoseMg, 4);
    assert.strictEqual(treatment.targetInrMin, 2.0);
    assert.strictEqual(treatment.targetInrMax, 3.0);
    assert.strictEqual(treatment.status, 'active');
  });

  it('finds treatments by patientId', async () => {
    const result: any = await app.service('sire-treatments').find({
      query: { patientId: patient.id },
    });

    const treatments = result.data || result;
    assert.ok(treatments.length > 0, 'Should find at least one treatment');
    assert.strictEqual(treatments[0].patientId, String(patient.id));
  });

  it('patches a treatment status', async () => {
    const treatment: any = await app.service('sire-treatments').create({
      patientId: patient.id,
      organizationId: org.id,
      medicId: user.id,
      medication: 'Warfarina',
      tabletDoseMg: 5,
      targetInrMin: 2.5,
      targetInrMax: 3.5,
      startDate: '2026-03-10',
      status: 'active',
    });

    const patched: any = await app.service('sire-treatments').patch(treatment.id, {
      status: 'completed',
      endDate: '2026-03-15',
    });

    assert.strictEqual(patched.status, 'completed');
    assert.strictEqual(patched.endDate, '2026-03-15');
  });
});
