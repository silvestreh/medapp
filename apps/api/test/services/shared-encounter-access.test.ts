import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'shared-encounter-access\' service', () => {
  let org: any;
  let medicA: any;
  let medicB: any;
  let patient: any;

  before(async () => {
    org = await createTestOrganization();

    medicA = await createTestUser({
      username: `test.medic.share.a.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    medicB = await createTestUser({
      username: `test.medic.share.b.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    patient = await app.service('patients').create({
      medicare: `SHARE_TEST_${Date.now()}`,
      medicareNumber: '55667788'
    });
  });

  it('registered the service', () => {
    const service = app.service('shared-encounter-access');
    assert.ok(service, 'Registered the service');
  });

  it('creates a grant for shared encounter access', async () => {
    const grant: any = await app.service('shared-encounter-access').create({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    assert.ok(grant.id, 'Grant has an ID');
    assert.strictEqual(grant.grantingMedicId, medicA.id);
    assert.strictEqual(grant.grantedMedicId, medicB.id);
    assert.strictEqual(grant.patientId, patient.id);
    assert.strictEqual(grant.organizationId, org.id);

    // Clean up
    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('enforces unique grant constraint', async () => {
    const grant: any = await app.service('shared-encounter-access').create({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    try {
      await app.service('shared-encounter-access').create({
        grantingMedicId: medicA.id,
        grantedMedicId: medicB.id,
        patientId: patient.id,
        organizationId: org.id,
      });
      assert.fail('Should not allow duplicate grant');
    } catch (error: any) {
      assert.ok(error, 'Threw an error for duplicate grant');
    }

    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('finds grants by grantingMedicId', async () => {
    const grant: any = await app.service('shared-encounter-access').create({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    const results = await app.service('shared-encounter-access').find({
      query: { grantingMedicId: medicA.id },
      paginate: false,
    } as any) as any[];

    assert.ok(results.length >= 1, 'Found at least one grant');
    assert.ok(
      results.some((r: any) => r.id === grant.id),
      'Found the created grant'
    );

    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('finds grants by grantedMedicId', async () => {
    const grant: any = await app.service('shared-encounter-access').create({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    const results = await app.service('shared-encounter-access').find({
      query: { grantedMedicId: medicB.id },
      paginate: false,
    } as any) as any[];

    assert.ok(results.length >= 1, 'Found at least one grant');
    assert.ok(
      results.some((r: any) => r.id === grant.id),
      'Found the created grant'
    );

    await app.service('shared-encounter-access').remove(grant.id);
  });

  it('can remove a grant', async () => {
    const grant: any = await app.service('shared-encounter-access').create({
      grantingMedicId: medicA.id,
      grantedMedicId: medicB.id,
      patientId: patient.id,
      organizationId: org.id,
    });

    await app.service('shared-encounter-access').remove(grant.id);

    const results = await app.service('shared-encounter-access').find({
      query: {
        grantingMedicId: medicA.id,
        grantedMedicId: medicB.id,
        patientId: patient.id,
      },
      paginate: false,
    } as any) as any[];

    assert.strictEqual(results.length, 0, 'Grant was removed');
  });
});
