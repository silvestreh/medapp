import crypto from 'crypto';
import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import { encryptValue } from '../../../hooks/encryption';
import { generateReadableSuffix } from '../../../utils/readable-suffix';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateUsername = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, data } = context;

  if (!data?.email) {
    return context;
  }

  const email = String(data.email).trim();

  if (!EMAIL_RE.test(email)) {
    throw new BadRequest('Invalid email address');
  }

  const normalizedEmail = email.toLowerCase();
  const encryptedEmail = encryptValue(normalizedEmail);

  const contactMatches = await app.service('contact-data').find({
    query: { email: encryptedEmail },
    paginate: false,
  }) as any[];

  if (contactMatches.length > 0) {
    const contactDataIds = contactMatches.map((c: any) => c.id);
    const ucdMatches = await app.service('user-contact-data').find({
      query: { contactDataId: { $in: contactDataIds } , $limit: 1 },
      paginate: false,
    }) as any[];

    if (ucdMatches.length > 0) {
      throw new BadRequest('An account with this email already exists');
    }
  }

  // Move email to contactData and remove from top-level data
  context.data.contactData = { ...context.data.contactData, email: normalizedEmail };
  context.data.emailConfirmed = context.data.emailConfirmed ?? false;
  context.params._signupEmail = normalizedEmail;
  delete context.data.email;

  // If username was explicitly provided, keep it
  if (data.username) {
    return context;
  }

  const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();

  let username = prefix;
  const existing = await app.service('users').find({
    query: { username, $limit: 1 },
    provider: undefined,
  } as any) as any;

  const count = existing?.total ?? (Array.isArray(existing) ? existing.length : 0);

  if (count > 0) {
    let found = false;
    for (let i = 0; i < 5; i++) {
      const candidate = `${prefix}-${generateReadableSuffix()}`;
      const check = await app.service('users').find({
        query: { username: candidate, $limit: 1 },
        provider: undefined,
      } as any) as any;
      const checkCount = check?.total ?? (Array.isArray(check) ? check.length : 0);

      if (checkCount === 0) {
        username = candidate;
        found = true;
        break;
      }
    }

    if (!found) {
      username = `${prefix}-${crypto.randomBytes(3).toString('hex')}`;
    }
  }

  context.data.username = username;

  return context;
};

export default generateUsername;
