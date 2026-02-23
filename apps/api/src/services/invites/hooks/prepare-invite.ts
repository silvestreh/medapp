import crypto from 'crypto';
import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

const INVITE_EXPIRY_DAYS = 7;

const generateToken = (): string => crypto.randomBytes(32).toString('hex');

const prepareInvite = (): Hook => async (context: HookContext): Promise<HookContext> => {
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

export default prepareInvite;
