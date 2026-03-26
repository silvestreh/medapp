import assert from 'assert';
import app from '../../src/app';

describe("'password-resets' service", () => {
  const testEmail = 'reset-test@example.com';
  const testPassword = 'OldPassword1!';
  const newPassword = 'NewPassword1!';
  let userId: string;

  before(async () => {
    const user = await app.service('users').create({
      email: testEmail,
      password: testPassword,
    } as any) as any;
    userId = user.id;
  });

  it('registered the service', () => {
    assert.ok(app.service('password-resets'));
  });

  it('creates a reset token for a valid email', async () => {
    const result: any = await app.service('password-resets').create({ email: testEmail } as any);
    assert.ok(result.id);
    assert.equal(result.status, 'pending');
  });

  it('silently succeeds for non-existent email (no enumeration)', async () => {
    const result: any = await app.service('password-resets').create({ email: 'nobody@nowhere.com' } as any);
    assert.ok(result.id);
    assert.equal(result.status, 'pending');
  });

  it('resets password with a valid token', async () => {
    const sequelize = app.get('sequelizeClient');
    const passwordResets = sequelize.models.password_resets;

    // Create a reset
    await app.service('password-resets').create({ email: testEmail } as any);

    // Get the token from the DB
    const resetRecord = await passwordResets.findOne({
      where: { userId, status: 'pending' },
      raw: true,
    });

    assert.ok(resetRecord, 'Reset record should exist');

    // Perform the reset
    const result: any = await app.service('password-resets').patch(null, {
      action: 'reset',
      token: resetRecord.token,
      password: newPassword,
    } as any);

    assert.equal(result.status, 'used');

    // Verify the new password works
    const { accessToken } = await app.service('authentication').create({
      strategy: 'local',
      username: testEmail,
      password: newPassword,
    }, {});

    assert.ok(accessToken, 'Should authenticate with new password');
  });

  it('rejects an already-used token', async () => {
    const sequelize = app.get('sequelizeClient');
    const passwordResets = sequelize.models.password_resets;

    await app.service('password-resets').create({ email: testEmail } as any);

    const resetRecord = await passwordResets.findOne({
      where: { userId, status: 'pending' },
      raw: true,
    });

    // Use the token
    await app.service('password-resets').patch(null, {
      action: 'reset',
      token: resetRecord.token,
      password: 'AnotherPass1!',
    } as any);

    // Try to use it again
    try {
      await app.service('password-resets').patch(null, {
        action: 'reset',
        token: resetRecord.token,
        password: 'YetAnother1!',
      } as any);
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
    }
  });

  it('rejects an expired token', async () => {
    const sequelize = app.get('sequelizeClient');
    const passwordResets = sequelize.models.password_resets;

    await app.service('password-resets').create({ email: testEmail } as any);

    const resetRecord = await passwordResets.findOne({
      where: { userId, status: 'pending' },
      raw: true,
    });

    // Manually expire the token
    await passwordResets.update(
      { expiresAt: new Date(Date.now() - 1000) },
      { where: { id: resetRecord.id } }
    );

    try {
      await app.service('password-resets').patch(null, {
        action: 'reset',
        token: resetRecord.token,
        password: 'ExpiredPass1!',
      } as any);
      assert.fail('Should have thrown');
    } catch (error: any) {
      assert.equal(error.code, 400);
      assert.ok(error.message.includes('expired'));
    }
  });
});
