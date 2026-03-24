import { HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import { generateTotpSecret, buildTotpAuthUri } from '../../../utils/totp';

export const setupTwoFactor = () => async (context: HookContext) => {
  const { app, id, params } = context;
  if (!params._twoFactorSetup) return context;

  const result = context.result;
  if (result.twoFactorEnabled) {
    throw new BadRequest('2FA is already enabled');
  }

  const secret = generateTotpSecret();
  const otpauthUri = buildTotpAuthUri({
    issuer: 'Athelas',
    accountName: result.username || String(id),
    secret,
  });

  // Store temp secret internally (bypasses protect hook)
  await app.service('users').patch(id!, { twoFactorTempSecret: secret }, { provider: undefined });

  // Attach setup data to result — protect() won't strip this custom field
  context.result = {
    ...result,
    twoFactorSetup: { secret, otpauthUri },
  };

  return context;
};
