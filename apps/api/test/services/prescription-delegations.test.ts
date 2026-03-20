import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('\'prescription-delegations\' service', () => {
  let org: any;
  let medic: any;
  let prescriber: any;
  let nonPrescriberUser: any;

  before(async () => {
    org = await createTestOrganization();

    medic = await createTestUser({
      username: `test.medic.deleg.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    prescriber = await createTestUser({
      username: `test.prescriber.deleg.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['prescriber'],
      organizationId: org.id,
    });

    nonPrescriberUser = await createTestUser({
      username: `test.receptionist.deleg.${Date.now()}`,
      password: 'SuperSecret1!',
      roleIds: ['receptionist'],
      organizationId: org.id,
    });
  });

  it('registered the service', () => {
    const service = app.service('prescription-delegations');
    assert.ok(service, 'Registered the service');
  });

  it('creates a delegation grant', async () => {
    const delegation: any = await app.service('prescription-delegations').create({
      medicId: medic.id,
      prescriberId: prescriber.id,
      organizationId: org.id,
    });

    assert.ok(delegation.id, 'Delegation has an ID');
    assert.strictEqual(delegation.medicId, medic.id);
    assert.strictEqual(delegation.prescriberId, prescriber.id);
    assert.strictEqual(delegation.organizationId, org.id);

    await app.service('prescription-delegations').remove(delegation.id);
  });

  it('enforces unique constraint', async () => {
    const delegation: any = await app.service('prescription-delegations').create({
      medicId: medic.id,
      prescriberId: prescriber.id,
      organizationId: org.id,
    });

    try {
      await app.service('prescription-delegations').create({
        medicId: medic.id,
        prescriberId: prescriber.id,
        organizationId: org.id,
      });
      assert.fail('Should not allow duplicate delegation');
    } catch (error: any) {
      assert.ok(error, 'Threw an error for duplicate delegation');
    }

    await app.service('prescription-delegations').remove(delegation.id);
  });

  it('finds delegations by medicId', async () => {
    const delegation: any = await app.service('prescription-delegations').create({
      medicId: medic.id,
      prescriberId: prescriber.id,
      organizationId: org.id,
    });

    const results = await app.service('prescription-delegations').find({
      query: { medicId: medic.id },
      paginate: false,
    } as any) as any[];

    assert.ok(results.length >= 1, 'Found at least one delegation');
    assert.ok(
      results.some((r: any) => r.id === delegation.id),
      'Found the created delegation'
    );

    await app.service('prescription-delegations').remove(delegation.id);
  });

  it('finds delegations by prescriberId', async () => {
    const delegation: any = await app.service('prescription-delegations').create({
      medicId: medic.id,
      prescriberId: prescriber.id,
      organizationId: org.id,
    });

    const results = await app.service('prescription-delegations').find({
      query: { prescriberId: prescriber.id },
      paginate: false,
    } as any) as any[];

    assert.ok(results.length >= 1, 'Found at least one delegation');
    assert.ok(
      results.some((r: any) => r.id === delegation.id),
      'Found the created delegation'
    );

    await app.service('prescription-delegations').remove(delegation.id);
  });

  it('rejects delegation to a non-prescriber user', async () => {
    try {
      await app.service('prescription-delegations').create({
        medicId: medic.id,
        prescriberId: nonPrescriberUser.id,
        organizationId: org.id,
      });
      assert.fail('Should not allow delegation to non-prescriber');
    } catch (error: any) {
      assert.strictEqual(error.code, 400);
      assert.ok(error.message.includes('prescriber'));
    }
  });

  it('can remove a delegation', async () => {
    const delegation: any = await app.service('prescription-delegations').create({
      medicId: medic.id,
      prescriberId: prescriber.id,
      organizationId: org.id,
    });

    await app.service('prescription-delegations').remove(delegation.id);

    const results = await app.service('prescription-delegations').find({
      query: {
        medicId: medic.id,
        prescriberId: prescriber.id,
      },
      paginate: false,
    } as any) as any[];

    assert.strictEqual(results.length, 0, 'Delegation was removed');
  });

  it('logs delegation events', async () => {
    const delegation: any = await app.service('prescription-delegations').create({
      medicId: medic.id,
      prescriberId: prescriber.id,
      organizationId: org.id,
    });

    // Wait a moment for fire-and-forget log to be written
    await new Promise(resolve => setTimeout(resolve, 200));

    const logs = await app.service('access-logs').find({
      query: {
        userId: medic.id,
        resource: 'prescriptions',
        action: 'grant',
        purpose: 'operations',
      },
      paginate: false,
    } as any) as any[];

    assert.ok(logs.length >= 1, 'Found at least one delegation log');
    const delegationLog = logs.find((l: any) => l.metadata?.prescriberId === prescriber.id);
    assert.ok(delegationLog, 'Delegation log has the prescriberId in metadata');
    assert.strictEqual(delegationLog.action, 'grant');
    assert.strictEqual(delegationLog.resource, 'prescriptions');

    await app.service('prescription-delegations').remove(delegation.id);
  });
});
