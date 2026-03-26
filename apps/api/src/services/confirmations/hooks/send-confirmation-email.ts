import { Hook, HookContext } from '@feathersjs/feathers';

const TEMPLATES: Record<string, { template: string; subject: string; urlPath: string }> = {
  'password-reset': {
    template: 'password-reset',
    subject: 'Reset your password',
    urlPath: 'reset-password',
  },
  'email-verification': {
    template: 'email-confirmation',
    subject: 'Confirm your email',
    urlPath: 'confirm-email',
  },
};

const sendConfirmationEmail = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, result, params } = context;
  const email = params._confirmationEmail as string | undefined;

  if (!email || !result?.token || !result?.type) return context;

  const config = TEMPLATES[result.type];
  if (!config) return context;

  const uiOrigin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
  const url = `${uiOrigin}/${config.urlPath}/${result.token}`;

  await app.service('mailer').create({
    template: config.template,
    to: email,
    subject: config.subject,
    data: { resetUrl: url, confirmUrl: url },
  });

  // Don't expose the token in the response
  context.result = { id: result.id, status: 'pending' };

  return context;
};

export default sendConfirmationEmail;
