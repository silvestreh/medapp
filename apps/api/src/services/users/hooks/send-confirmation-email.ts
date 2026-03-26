import crypto from 'crypto';
import { Hook, HookContext } from '@feathersjs/feathers';

const sendConfirmationEmail = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, result } = context;

  // Only send for email signups (emailConfirmed explicitly set to false)
  if (result?.emailConfirmed !== false) return context;

  const email = context.params._signupEmail as string | undefined;
  if (!email) return context;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const sequelize = app.get('sequelizeClient');
  await sequelize.models.confirmations.create({
    userId: result.id,
    type: 'email-verification',
    token,
    status: 'pending',
    expiresAt,
  });

  const uiOrigin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
  const confirmUrl = `${uiOrigin}/confirm-email/${token}`;

  await app.service('mailer').create({
    template: 'email-confirmation',
    to: email,
    subject: 'Confirm your email',
    data: { confirmUrl },
  });

  return context;
};

export default sendConfirmationEmail;
