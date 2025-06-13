import assert from 'assert';
import app from '../src/app';
import type { User } from '../src/declarations';
describe('authentication', () => {
  let user: User;

  it('registered the authentication service', () => {
    assert.ok(app.service('authentication'));
  });

  describe('local strategy', () => {
    const userInfo = {
      username: 'someone@example.com',
      password: 'supersecret',
      roleId: 'receptionist'
    };

    before(async () => {
      try {
        user = await app.service('users').create(userInfo);
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
      await app.service('users').remove(user.id);
    });
  });
});
