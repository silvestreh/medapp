import assert from 'assert';
import app from '../../src/app';
import { getUserPermissions } from '../../src/utils/get-user-permissions';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('Configuration and role change logging', () => {
  let org: any;
  let owner: any;

  before(async () => {
    org = await createTestOrganization();
    owner = await createTestUser({
      username: `test.config.owner.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['owner'],
      organizationId: org.id,
    });
  });

  it('logs organization settings changes', async () => {
    const orgPermissions = await getUserPermissions(app, owner.id, org.id);

    await app.service('organizations').patch(org.id, {
      settings: { refesId: 'REFES-TEST-CONFIG' },
    }, {
      provider: 'rest',
      authenticated: true,
      user: owner,
      organizationId: org.id,
      orgPermissions,
      orgRoleIds: ['owner'],
    } as any);

    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        userId: owner.id,
        resource: 'configuration',
        action: 'write',
      },
      paginate: false,
    } as any) as any[];

    const configLog = logs.find((l: any) =>
      l.organizationId === org.id
    );
    assert.ok(configLog, 'Found configuration change log');
    assert.strictEqual(configLog.purpose, 'operations');
    assert.ok(configLog.metadata?.changedFields, 'Has changedFields in metadata');
  });

  it('logs user role assignments', async () => {
    const newUser = await createTestUser({
      username: `test.role.assign.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: [],
      organizationId: org.id,
    });

    const orgPermissions = await getUserPermissions(app, owner.id, org.id);

    await app.service('user-roles').create({
      userId: newUser.id,
      roleId: 'medic',
      organizationId: org.id,
    } as any, {
      provider: 'rest',
      authenticated: true,
      user: owner,
      organizationId: org.id,
      orgPermissions,
      orgRoleIds: ['owner'],
    } as any);

    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        userId: owner.id,
        resource: 'user-management',
        action: 'write',
      },
      paginate: false,
    } as any) as any[];

    const roleLog = logs.find((l: any) =>
      l.metadata?.targetUserId === String(newUser.id) &&
      l.metadata?.changeType === 'assign'
    );
    assert.ok(roleLog, 'Found role assignment log');
    assert.strictEqual(roleLog.metadata.roleId, 'medic');
    assert.strictEqual(roleLog.purpose, 'operations');
  });

  it('logs user role revocations', async () => {
    const revokeUser = await createTestUser({
      username: `test.role.revoke.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    const orgPermissions = await getUserPermissions(app, owner.id, org.id);

    // Find the user-role entry
    const userRoles = await app.service('user-roles').find({
      query: {
        userId: revokeUser.id,
        roleId: 'medic',
        organizationId: org.id,
      },
      paginate: false,
    } as any) as any[];

    assert.ok(userRoles.length > 0, 'Found user role to revoke');

    await app.service('user-roles').remove(userRoles[0].id, {
      provider: 'rest',
      authenticated: true,
      user: owner,
      organizationId: org.id,
      orgPermissions,
      orgRoleIds: ['owner'],
    } as any);

    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        userId: owner.id,
        resource: 'user-management',
        action: 'write',
      },
      paginate: false,
    } as any) as any[];

    const revokeLog = logs.find((l: any) =>
      l.metadata?.targetUserId === String(revokeUser.id) &&
      l.metadata?.changeType === 'revoke'
    );
    assert.ok(revokeLog, 'Found role revocation log');
    assert.strictEqual(revokeLog.metadata.roleId, 'medic');
  });
});
