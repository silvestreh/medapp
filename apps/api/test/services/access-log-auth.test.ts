import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';

describe('Authentication event logging', () => {
  let org: any;
  let user: any;

  before(async () => {
    org = await createTestOrganization();
    user = await createTestUser({
      username: `test.auth.log.${Date.now()}`,
      password: 'SuperSecret1',
      roleIds: ['medic'],
      organizationId: org.id,
    });
  });

  it('logs a successful login', async () => {
    await app.service('authentication').create({
      strategy: 'local',
      username: user.username,
      password: 'SuperSecret1',
    }, { provider: 'rest' });

    // Wait for fire-and-forget log
    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        userId: user.id,
        resource: 'authentication',
        action: 'login',
      },
      paginate: false,
    } as any) as any[];

    assert.ok(logs.length >= 1, 'Found at least one login log');
    assert.strictEqual(logs[0].resource, 'authentication');
    assert.strictEqual(logs[0].action, 'login');
    assert.strictEqual(logs[0].purpose, 'operations');
  });

  it('logs a failed login attempt', async () => {
    try {
      await app.service('authentication').create({
        strategy: 'local',
        username: user.username,
        password: 'WrongPassword123',
      }, { provider: 'rest' });
    } catch {
      // Expected to fail
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        resource: 'authentication',
        action: 'deny',
      },
      paginate: false,
    } as any) as any[];

    const failedLog = logs.find((l: any) =>
      l.metadata?.attemptedUsername === user.username
    );
    assert.ok(failedLog, 'Found failed login log');
    assert.strictEqual(failedLog.purpose, 'operations');
    assert.strictEqual(failedLog.userId, null);
  });

  it('registered the logout service', () => {
    const service = (app as any).service('logout');
    assert.ok(service, 'Logout service is registered');
  });

  it('logs a logout event', async () => {
    const authResult = await app.service('authentication').create({
      strategy: 'local',
      username: user.username,
      password: 'SuperSecret1',
    }, { provider: 'rest' });

    await (app as any).service('logout').create({}, {
      provider: 'rest',
      authenticated: true,
      user,
      authentication: {
        strategy: 'jwt',
        accessToken: authResult.accessToken,
      },
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    const logs = await app.service('access-logs').find({
      query: {
        userId: user.id,
        resource: 'authentication',
        action: 'logout',
      },
      paginate: false,
    } as any) as any[];

    assert.ok(logs.length >= 1, 'Found at least one logout log');
    assert.strictEqual(logs[0].purpose, 'operations');
  });
});
