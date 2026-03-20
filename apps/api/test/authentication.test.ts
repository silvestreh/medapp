import assert from 'assert';
import app from '../src/app';
import type { User } from '../src/declarations';
import { createTestUser, createTestOrganization } from './test-helpers';

describe('authentication', () => {
  let user: User;

  it('registered the authentication service', () => {
    assert.ok(app.service('authentication'));
  });

  describe('local strategy', () => {
    const userInfo = {
      username: 'someone@example.com',
      password: 'SuperSecret1!',
    };

    before(async () => {
      try {
        const org = await createTestOrganization();
        user = await createTestUser({
          ...userInfo,
          roleIds: ['receptionist'],
          organizationId: org.id,
        });
      } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
        // Do nothing, it just means the user already exists and can be tested
      }
    });

    it('authenticates user and creates accessToken', async () => {
      const { user: authenticatedUser, accessToken } = await app.service('authentication').create({
        strategy: 'local',
        ...userInfo
      }, {});

      assert.ok(accessToken, 'Created access token for user');
      assert.ok(authenticatedUser, 'Includes user in authentication data');

      const userRoles = await app.service('user-roles').find({
        query: { userId: user.id },
        paginate: false,
      } as any) as any[];
      for (const ur of userRoles) {
        await app.service('user-roles').remove(ur.id);
      }

      const orgUsers = await app.service('organization-users').find({
        query: { userId: user.id },
        paginate: false,
      } as any) as any[];
      for (const ou of orgUsers) {
        await app.service('organization-users').remove(ou.id);
      }

      const accessLogs = await app.service('access-logs').find({
        query: { userId: user.id },
        paginate: false,
      } as any) as any[];
      for (const log of accessLogs) {
        await app.service('access-logs').remove(log.id);
      }

      await app.service('users').remove(user.id);
    });
  });
});
