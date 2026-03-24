import { HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import { verifyTotpCode } from '../../../utils/totp';

export const enableTwoFactor = () => async (context: HookContext) => {
  const { app, id, params } = context;
  if (!params._twoFactorCode) return context;

  const code = params._twoFactorCode as string;

  // Fetch full user internally to get the temp secret (bypasses protect hook)
  const user = await app.service('users').get(id!, { provider: undefined });

  if (user.twoFactorEnabled) {
    throw new BadRequest('2FA is already enabled');
  }

  if (!user.twoFactorTempSecret) {
    throw new BadRequest('No 2FA setup in progress. Call setup first.');
  }

  const valid = verifyTotpCode({ secret: user.twoFactorTempSecret, code });
  if (!valid) {
    throw new BadRequest('Invalid 2FA code');
  }

  // Move temp secret to permanent and enable 2FA
  await app.service('users').patch(id!, {
    twoFactorSecret: user.twoFactorTempSecret,
    twoFactorTempSecret: null,
    twoFactorEnabled: true,
  }, { provider: undefined });

  context.result = {
    ...context.result,
    twoFactorEnabled: true,
  };

  return context;
};
