import crypto from 'crypto';
import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';
import { encryptValue } from '../../../hooks/encryption';

const generateTempPassword = (): string => crypto.randomBytes(48).toString('base64url');

const resolveAndNotify = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, result } = context;
  const invite = result;

  const encryptedEmail = encryptValue(invite.email);

  const contactMatches = await app.service('contact-data').find({
    query: { email: encryptedEmail, $limit: 1 },
    paginate: false,
  }) as any[];

  let existingUserId: string | null = null;
  if (contactMatches.length > 0) {
    const ucdMatches = await app.service('user-contact-data').find({
      query: { contactDataId: contactMatches[0].id, $limit: 1 },
      paginate: false,
    }) as any[];
    existingUserId = ucdMatches[0]?.ownerId ?? null;
  }
  let isNewUser = false;
  let username: string | undefined;

  if (existingUserId) {
    const alreadyMember: any[] = await app.service('organization-users').find({
      query: { userId: existingUserId, organizationId: invite.organizationId },
      paginate: false,
    } as any);

    if (alreadyMember.length > 0) {
      await app.service('invites').patch(invite.id, { status: 'cancelled' }, { provider: undefined } as any);
      throw new BadRequest('This user is already a member of the organization');
    }

    await app.service('invites').patch(invite.id, { userId: existingUserId }, { provider: undefined } as any);
  } else {
    isNewUser = true;
    const emailPrefix = invite.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
    username = emailPrefix;

    const existingByUsername = await app.service('users').find({
      query: { username, $limit: 1 },
      provider: undefined,
    } as any) as any;

    const usernameCount = existingByUsername?.total ?? (Array.isArray(existingByUsername) ? existingByUsername.length : 0);

    if (usernameCount > 0) {
      username = `${emailPrefix}.${crypto.randomBytes(3).toString('hex')}`;
    }

    const tempPassword = generateTempPassword();
    const roleId = ['admin', 'medic', 'receptionist', 'lab-tech', 'lab-owner'].includes(invite.role)
      ? invite.role
      : 'receptionist';

    const newUser = await app.service('users').create(
      {
        username,
        password: tempPassword,
        roleId,
        contactData: { email: invite.email },
      },
      { provider: undefined } as any
    );

    await app.service('invites').patch(invite.id, { userId: newUser.id, isNewUser: true }, { provider: undefined } as any);
  }

  const org = await app.service('organizations').get(invite.organizationId, { provider: undefined } as any);
  const inviter = await app.service('users').get(invite.invitedBy, { provider: undefined } as any);
  const inviterName = inviter?.username ?? 'Someone';

  const uiOrigin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';
  const inviteUrl = `${uiOrigin}/invite/${invite.token}`;

  const template = isNewUser ? 'org-invite-new-user' : 'org-invite';
  const subject = isNewUser
    ? `Welcome to ${org.name} on MedApp`
    : `You've been invited to ${org.name}`;

  const mailerResult = await app.service('mailer').create({
    template,
    to: invite.email,
    subject,
    data: {
      organizationName: org.name,
      inviteUrl,
      inviterName,
      ...(isNewUser ? { username } : {}),
    },
  });

  context.dispatch = {
    ...invite,
    ...(mailerResult.html ? { _emailHtml: mailerResult.html } : {}),
  };

  return context;
};

export default resolveAndNotify;
