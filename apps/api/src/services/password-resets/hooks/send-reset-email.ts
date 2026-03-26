import { Hook, HookContext } from '@feathersjs/feathers';

const sendResetEmail = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, result, params } = context;
  const email = params._resetEmail as string | undefined;

  if (!email || !result?.token) return context;

  const uiOrigin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
  const resetUrl = `${uiOrigin}/reset-password/${result.token}`;

  await app.service('mailer').create({
    template: 'password-reset',
    to: email,
    subject: 'Reset your password',
    data: { resetUrl },
  });

  // Don't expose the token in the response
  context.result = { id: result.id, status: 'pending' };

  return context;
};

export default sendResetEmail;
