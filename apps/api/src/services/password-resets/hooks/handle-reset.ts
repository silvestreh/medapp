import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest, NotAuthenticated } from '@feathersjs/errors';
import { isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../../utils/validate-password';
import { verifyTotpCode } from '../../../utils/totp';

const handleReset = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, data } = context;

  if (data?.action !== 'reset') return context;

  const { password, twoFactorCode, token } = data;

  if (!password) {
    throw new BadRequest('Password is required');
  }

  if (!token) {
    throw new BadRequest('Token is required');
  }

  if (!isPasswordValid(password)) {
    throw new BadRequest(PASSWORD_POLICY_MESSAGE);
  }

  // Look up the reset record by token
  const sequelize = app.get('sequelizeClient');
  const passwordResets = sequelize.models.password_resets;

  const resetRecord = await passwordResets.findOne({
    where: { token },
    raw: true,
  });

  if (!resetRecord || resetRecord.status !== 'pending') {
    throw new BadRequest('This reset link is invalid or has already been used');
  }

  if (new Date(resetRecord.expiresAt) < new Date()) {
    await passwordResets.update({ status: 'expired' }, { where: { id: resetRecord.id } });
    throw new BadRequest('This reset link has expired');
  }

  // Check if user has 2FA enabled
  const usersModel = sequelize.models.users;
  const user = await usersModel.findOne({
    where: { id: resetRecord.userId },
    raw: true,
  });

  if (!user) {
    throw new BadRequest('User not found');
  }

  if (user.twoFactorEnabled) {
    if (!twoFactorCode) {
      throw new NotAuthenticated('2FA code is required', { reason: '2fa_required' });
    }

    if (!user.twoFactorSecret || !verifyTotpCode({ secret: user.twoFactorSecret, code: twoFactorCode })) {
      throw new BadRequest('Invalid 2FA code');
    }
  }

  // Hash and update password via the users service (which runs hashPassword hook)
  await app.service('users').patch(
    resetRecord.userId,
    { password },
    { provider: undefined, authenticated: true }
  );

  // Mark reset as used
  await passwordResets.update({ status: 'used' }, { where: { id: resetRecord.id } });

  context.result = { id: resetRecord.id, status: 'used' };

  return context;
};

export default handleReset;
