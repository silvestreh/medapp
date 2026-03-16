import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('Access control denial logging', () => {
  it('logs a 403 Forbidden error', async () => {
    const org = await createTestOrganization();
    const user = await createTestUser({
      username: `test.denial.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    // Try to access access-log-chain-verification without being super admin
    try {
      await app.service('access-log-chain-verification').find({
        query: { organizationId: org.id },
        provider: 'rest',
        authenticated: true,
        user,
      } as any);
    } catch {
      // Expected 403
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        resource: 'access-control',
        action: 'deny',
      },
      paginate: false,
    } as any) as any[];

    const denialLog = logs.find((l: any) =>
      l.metadata?.service === 'access-log-chain-verification' &&
      l.userId === user.id
    );
    assert.ok(denialLog, 'Found access denial log');
    assert.strictEqual(denialLog.metadata.errorCode, 403);
    assert.strictEqual(denialLog.purpose, 'operations');
  });

  it('does not log denials on the authentication service', async () => {
    const beforeLogs = await app.service('access-logs').find({
      query: {
        resource: 'access-control',
        action: 'deny',
      },
      paginate: false,
    } as any) as any[];

    try {
      await app.service('authentication').create({
        strategy: 'local',
        username: 'nonexistent-user-denial-test',
        password: 'wrong',
      }, { provider: 'rest' });
    } catch {
      // Expected
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const afterLogs = await app.service('access-logs').find({
      query: {
        resource: 'access-control',
        action: 'deny',
      },
      paginate: false,
    } as any) as any[];

    const newDenials = afterLogs.filter((l: any) =>
      l.metadata?.service === 'authentication' &&
      !beforeLogs.some((b: any) => b.id === l.id)
    );
    assert.strictEqual(newDenials.length, 0, 'No access-control denial logged for authentication service');
  });
});
