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

  // Store temp secret via Sequelize directly to avoid triggering hook cycle
  const sequelize = app.get('sequelizeClient');
  await sequelize.models.users.update(
    { twoFactorTempSecret: secret },
    { where: { id } },
  );

  // Attach setup data to both result and dispatch
  const setupData = { secret, otpauthUri };
  context.result = { ...result, twoFactorSetup: setupData };
  context.dispatch = { ...context.dispatch || context.result, twoFactorSetup: setupData };

  return context;
};
