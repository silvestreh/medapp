import crypto from 'crypto';
import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import { Op } from 'sequelize';
import { encryptValue } from '../../../hooks/encryption';

const prepareReset = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, data } = context;
  const email = data?.email?.trim()?.toLowerCase();

  if (!email) {
    throw new BadRequest('Email is required');
  }

  // Find user by email via contact_data → user_contact_data
  const sequelize = app.get('sequelizeClient');
  const { contact_data, user_contact_data, users } = sequelize.models;
  const encryptedEmail = encryptValue(email);

  const contactRecords = await contact_data.findAll({
    where: { email: encryptedEmail },
    attributes: ['id'],
    raw: true,
  });

  let userId: string | null = null;

  if (contactRecords.length > 0) {
    const contactDataIds = contactRecords.map((r: any) => r.id);
    const ucdRecord = await user_contact_data.findOne({
      where: { contactDataId: { [Op.in]: contactDataIds } },
      attributes: ['ownerId'],
      raw: true,
    });
    userId = ucdRecord?.ownerId ?? null;
  }

  if (!userId) {
    // Don't reveal whether the email exists — silently succeed
    context.result = { id: 'noop', status: 'pending' };
    return context;
  }

  // Expire any existing pending resets for this user
  const passwordResets = sequelize.models.password_resets;
  await passwordResets.update(
    { status: 'expired' },
    { where: { userId, status: 'pending' } }
  );

  // Generate token and set expiry (1 hour)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  context.data = { userId, token, status: 'pending', expiresAt };

  // Store email and user for the after hook (sending email)
  context.params._resetEmail = email;
  context.params._resetUserId = userId;

  return context;
};

export default prepareReset;
