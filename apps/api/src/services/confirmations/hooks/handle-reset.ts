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

  const sequelize = app.get('sequelizeClient');
  const confirmations = sequelize.models.confirmations;

  const resetRecord = await confirmations.findOne({
    where: { token, type: 'password-reset' },
    raw: true,
  });

  if (!resetRecord || resetRecord.status !== 'pending') {
    throw new BadRequest('This reset link is invalid or has already been used');
  }

  if (new Date(resetRecord.expiresAt) < new Date()) {
    await confirmations.update({ status: 'expired' }, { where: { id: resetRecord.id } });
    throw new BadRequest('This reset link has expired');
  }

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

  await app.service('users').patch(
    resetRecord.userId,
    { password },
    { provider: undefined, authenticated: true }
  );

  await confirmations.update({ status: 'used' }, { where: { id: resetRecord.id } });

  context.result = { id: resetRecord.id, status: 'used' };

  return context;
};

export default handleReset;
