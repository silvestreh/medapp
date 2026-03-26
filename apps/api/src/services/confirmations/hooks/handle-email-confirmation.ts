import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

const handleEmailConfirmation = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, data } = context;

  if (data?.action !== 'confirm-email') return context;

  const { token } = data;

  if (!token) {
    throw new BadRequest('Token is required');
  }

  const sequelize = app.get('sequelizeClient');
  const confirmations = sequelize.models.confirmations;

  const record = await confirmations.findOne({
    where: { token, type: 'email-verification' },
    raw: true,
  });

  if (!record || record.status !== 'pending') {
    throw new BadRequest('This confirmation link is invalid or has already been used');
  }

  if (new Date(record.expiresAt) < new Date()) {
    await confirmations.update({ status: 'expired' }, { where: { id: record.id } });
    throw new BadRequest('This confirmation link has expired');
  }

  // Set emailConfirmed = true on the user
  const usersModel = sequelize.models.users;
  await usersModel.update(
    { emailConfirmed: true },
    { where: { id: record.userId } }
  );

  // Mark confirmation as used
  await confirmations.update({ status: 'used' }, { where: { id: record.id } });

  context.result = { id: record.id, status: 'used' };

  return context;
};

export default handleEmailConfirmation;
