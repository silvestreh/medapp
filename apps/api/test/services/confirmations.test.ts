import assert from 'assert';
import app from '../../src/app';

describe('\'confirmations\' service', () => {
  it('registered the service', () => {
    assert.ok(app.service('confirmations'));
  });

  describe('password-reset type', () => {
    const testEmail = 'reset-test@example.com';
    const testPassword = 'OldPassword1!';
    const newPassword = 'NewPassword1!';
    let userId: string;

    before(async () => {
      const user = await app.service('users').create({
        email: testEmail,
        password: testPassword,
        emailConfirmed: true,
      } as any) as any;
      userId = user.id;
    });

    it('creates a reset token for a valid email', async () => {
      const result: any = await app.service('confirmations').create({
        email: testEmail,
        type: 'password-reset',
      } as any);
      assert.ok(result.id);
      assert.equal(result.status, 'pending');
    });

    it('silently succeeds for non-existent email', async () => {
      const result: any = await app.service('confirmations').create({
        email: 'nobody@nowhere.com',
        type: 'password-reset',
      } as any);
      assert.ok(result.id);
      assert.equal(result.status, 'pending');
    });

    it('resets password with a valid token', async () => {
      const sequelize = app.get('sequelizeClient');
      const confirmations = sequelize.models.confirmations;

      await app.service('confirmations').create({
        email: testEmail,
        type: 'password-reset',
      } as any);

      const record = await confirmations.findOne({
        where: { userId, status: 'pending', type: 'password-reset' },
        raw: true,
      });

      assert.ok(record, 'Reset record should exist');

      const result: any = await app.service('confirmations').patch(null, {
        action: 'reset',
        token: record.token,
        password: newPassword,
      } as any);

      assert.equal(result.status, 'used');

      const { accessToken } = await app.service('authentication').create({
        strategy: 'local',
        username: testEmail,
        password: newPassword,
      }, {});

      assert.ok(accessToken, 'Should authenticate with new password');
    });

    it('rejects an already-used token', async () => {
      const sequelize = app.get('sequelizeClient');
      const confirmations = sequelize.models.confirmations;

      await app.service('confirmations').create({
        email: testEmail,
        type: 'password-reset',
      } as any);

      const record = await confirmations.findOne({
        where: { userId, status: 'pending', type: 'password-reset' },
        raw: true,
      });

      await app.service('confirmations').patch(null, {
        action: 'reset',
        token: record.token,
        password: 'AnotherPass1!',
      } as any);

      try {
        await app.service('confirmations').patch(null, {
          action: 'reset',
          token: record.token,
          password: 'YetAnother1!',
        } as any);
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
      }
    });

    it('rejects an expired token', async () => {
      const sequelize = app.get('sequelizeClient');
      const confirmations = sequelize.models.confirmations;

      await app.service('confirmations').create({
        email: testEmail,
        type: 'password-reset',
      } as any);

      const record = await confirmations.findOne({
        where: { userId, status: 'pending', type: 'password-reset' },
        raw: true,
      });

      await confirmations.update(
        { expiresAt: new Date(Date.now() - 1000) },
        { where: { id: record.id } }
      );

      try {
        await app.service('confirmations').patch(null, {
          action: 'reset',
          token: record.token,
          password: 'ExpiredPass1!',
        } as any);
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 400);
        assert.ok(error.message.includes('expired'));
      }
    });
  });

  describe('email-verification type', () => {
    const signupEmail = 'verify-test@example.com';
    const signupPassword = 'Password123!';
    let signupUserId: string;

    it('signup creates an unconfirmed user', async () => {
      const user = await app.service('users').create({
        email: signupEmail,
        password: signupPassword,
      } as any) as any;

      signupUserId = user.id;
      assert.equal(user.emailConfirmed, false);
    });

    it('unconfirmed user cannot log in', async () => {
      try {
        await app.service('authentication').create({
          strategy: 'local',
          username: signupEmail,
          password: signupPassword,
        }, {});
        assert.fail('Should have thrown');
      } catch (error: any) {
        assert.equal(error.code, 401);
        assert.equal(error.data?.reason, 'email_not_confirmed');
      }
    });

    it('confirming with valid token sets emailConfirmed = true', async () => {
      const sequelize = app.get('sequelizeClient');
      const confirmations = sequelize.models.confirmations;

      const record = await confirmations.findOne({
        where: { userId: signupUserId, type: 'email-verification', status: 'pending' },
        raw: true,
      });

      assert.ok(record, 'Confirmation record should exist');

      const result: any = await app.service('confirmations').patch(null, {
        action: 'confirm-email',
        token: record.token,
      } as any);

      assert.equal(result.status, 'used');
    });

    it('confirmed user can log in', async () => {
      const { accessToken } = await app.service('authentication').create({
        strategy: 'local',
        username: signupEmail,
        password: signupPassword,
      }, {});

      assert.ok(accessToken, 'Should authenticate after confirmation');
    });

    it('users created with emailConfirmed=true can log in immediately', async () => {
      const email = 'preconfirmed@example.com';
      const password = 'Password123!';

      // Simulate invite-created user (emailConfirmed: true)
      await app.service('users').create({
        email,
        password,
        emailConfirmed: true,
      } as any);

      const { accessToken } = await app.service('authentication').create({
        strategy: 'local',
        username: email,
        password,
      }, {});

      assert.ok(accessToken, 'Pre-confirmed user should authenticate immediately');
    });
  });
});
