import crypto from 'crypto';
import { HooksObject, HookContext } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import * as local from '@feathersjs/authentication-local';
import { BadRequest, Forbidden, NotFound } from '@feathersjs/errors';
import { encryptValue } from '../../hooks/encryption';
import { getUserPermissions } from '../../utils/get-user-permissions';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';

const { authenticate } = authentication.hooks;
const { hashPassword } = local.hooks;

const INVITE_EXPIRY_DAYS = 7;

const generateToken = (): string => crypto.randomBytes(32).toString('hex');
const generateTempPassword = (): string => crypto.randomBytes(48).toString('base64url');

const requireUserManagement = () => async (context: HookContext): Promise<HookContext> => {
  const { app, params } = context;
  if (params.provider === undefined || !params.user) return context;

  const permissions = await getUserPermissions(app, params.user.id, params.user.roleId);
  if (!permissions.includes('users:create') && !permissions.includes('users:create:all')) {
    throw new Forbidden('You do not have permission to invite users');
  }
  return context;
};

const prepareInvite = () => async (context: HookContext): Promise<HookContext> => {
  const { params, data } = context;

  if (!data?.email || typeof data.email !== 'string') {
    throw new BadRequest('Email is required');
  }

  data.email = data.email.trim().toLowerCase();
  data.invitedBy = params.user!.id;
  data.organizationId = params.organizationId;

  if (!data.organizationId) {
    throw new BadRequest('Organization context is required');
  }

  data.token = generateToken();
  data.status = 'pending';
  data.expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return context;
};

const resolveAndNotify = () => async (context: HookContext): Promise<HookContext> => {
  const { app, result } = context;
  const invite = result;
  const sequelize = app.get('sequelizeClient');

  const encryptedEmail = encryptValue(invite.email);

  const matchRows = await sequelize.query(
    `SELECT ucd."ownerId" AS "userId"
       FROM user_contact_data ucd
       JOIN contact_data cd ON cd.id = ucd."contactDataId"
      WHERE cd.email = :email
      LIMIT 1`,
    { replacements: { email: encryptedEmail }, type: sequelize.constructor.QueryTypes.SELECT }
  ) as any[];

  const existingUserId = matchRows?.[0]?.userId ?? null;
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

const allowPublicTokenLookup = () => async (context: HookContext): Promise<HookContext> => {
  const { params } = context;

  if (params.query?.token && params.provider) {
    context.params = { ...params, authenticated: true };
  }

  return context;
};

const allowPublicAcceptPatch = () => async (context: HookContext): Promise<HookContext> => {
  const { data, params } = context;

  if (data?.action === 'accept' && params.provider) {
    context.params = { ...params, authenticated: true, _isAcceptAction: true };
  }

  return context;
};

const handleAcceptAction = () => async (context: HookContext): Promise<HookContext> => {
  if (!context.params._isAcceptAction) return context;

  const { app, id, data } = context;

  const invite = await app.service('invites').get(id!, { provider: undefined } as any);

  if (!invite) {
    throw new NotFound('Invite not found');
  }

  if (invite.status !== 'pending') {
    throw new BadRequest(`This invite has already been ${invite.status}`);
  }

  if (new Date(invite.expiresAt) < new Date()) {
    await app.service('invites').patch(invite.id, { status: 'expired' }, { provider: undefined } as any);
    throw new BadRequest('This invite has expired');
  }

  if (!invite.userId) {
    throw new BadRequest('This invite is not associated with a user');
  }

  if (data.password) {
    context.data = { password: data.password };
    await hashPassword('password')(context);
    const hashedPassword = context.data.password;

    const sequelize = app.get('sequelizeClient');
    await sequelize.models.users.update(
      { password: hashedPassword },
      { where: { id: invite.userId } }
    );
  }

  await app.service('organization-users').create(
    {
      organizationId: invite.organizationId,
      userId: invite.userId,
      role: 'member',
    },
    { provider: undefined } as any
  );

  context.data = { status: 'accepted' };

  return context;
};

const sanitizeFindResult = () => async (context: HookContext): Promise<HookContext> => {
  const { params, result } = context;

  if (!params.user && params.provider) {
    const sanitize = (item: any) => ({
      id: item.id,
      organizationId: item.organizationId,
      status: item.status,
      expiresAt: item.expiresAt,
      userId: item.userId,
      token: item.token,
      isNewUser: item.isNewUser,
    });

    if (result?.data) {
      result.data = result.data.map(sanitize);
    } else if (Array.isArray(result)) {
      context.result = result.map(sanitize);
    }
  }

  return context;
};

export default {
  before: {
    all: [],
    find: [allowPublicTokenLookup()],
    get: [authenticate('jwt')],
    create: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      requireUserManagement(),
      prepareInvite(),
    ],
    update: [authenticate('jwt')],
    patch: [
      allowPublicAcceptPatch(),
      handleAcceptAction(),
    ],
    remove: [authenticate('jwt')]
  },

  after: {
    all: [],
    find: [sanitizeFindResult()],
    get: [],
    create: [resolveAndNotify()],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
} as HooksObject;
