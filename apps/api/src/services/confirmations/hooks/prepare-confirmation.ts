import crypto from 'crypto';
import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import { Op } from 'sequelize';
import { encryptValue } from '../../../hooks/encryption';

const EXPIRY_HOURS: Record<string, number> = {
  'password-reset': 1,
  'email-verification': 24,
};

const prepareConfirmation = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, data } = context;
  const email = data?.email?.trim()?.toLowerCase();
  const type = data?.type || 'password-reset';

  if (!email) {
    throw new BadRequest('Email is required');
  }

  if (!EXPIRY_HOURS[type]) {
    throw new BadRequest('Invalid confirmation type');
  }

  // Find user by email via contact_data → user_contact_data
  const sequelize = app.get('sequelizeClient');
  const { contact_data, user_contact_data } = sequelize.models;
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

  // Expire any existing pending confirmations of the same type for this user
  const confirmations = sequelize.models.confirmations;
  await confirmations.update(
    { status: 'expired' },
    { where: { userId, status: 'pending', type } }
  );

  // Generate token and set expiry
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS[type] * 60 * 60 * 1000);

  context.data = { userId, type, token, status: 'pending', expiresAt };

  // Store email for the after hook (sending email)
  context.params._confirmationEmail = email;

  return context;
};

export default prepareConfirmation;
