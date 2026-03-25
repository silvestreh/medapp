import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { BadRequest, Forbidden, NotAuthenticated } from '@feathersjs/errors';
import crypto from 'crypto';

const { authenticate } = authentication.hooks;

const SESSION_TTL_MINUTES = 15;

/**
 * Authenticate via publishable key (frontend), secret API key (backend), or JWT.
 * Publishable keys (WIDGET_PUBLISHABLE_KEY) are safe to expose in browser code.
 * Secret keys (WIDGET_API_KEY) are for server-to-server calls.
 * Both require userId in the request body.
 */
const authenticateApiKeyOrJwt = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    const headers = context.params.headers || {};

    // 1. Publishable key (frontend-safe, can only create sessions)
    const publishableKey = headers['x-publishable-key'];
    const expectedPublishable = process.env.WIDGET_PUBLISHABLE_KEY;
    if (publishableKey && expectedPublishable && publishableKey === expectedPublishable) {
      if (!context.data.userId) {
        throw new BadRequest('userId is required when using publishable key authentication');
      }
      context.params.authenticated = true;
      context.params.user = { id: context.data.userId };
      return context;
    }

    // 2. Secret API key (server-to-server)
    const apiKey = headers['x-api-key'];
    const expectedKey = process.env.WIDGET_API_KEY;
    if (apiKey && expectedKey && apiKey === expectedKey) {
      if (!context.data.userId) {
        throw new BadRequest('userId is required when using API key authentication');
      }
      context.params.authenticated = true;
      context.params.user = { id: context.data.userId };
      return context;
    }

    // 3. JWT auth
    return authenticate('jwt')(context);
  };
};

const generateSessionToken = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    const user = context.params.user;
    if (!user) {
      throw new NotAuthenticated('Authentication required');
    }

    context.data.userId = user.id;
    context.data.token = crypto.randomBytes(32).toString('hex');
    context.data.status = 'waiting';
    context.data.expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);
    context.data.idFrontUrl = null;
    context.data.idBackUrl = null;
    context.data.selfieUrl = null;

    // Pass through callbackUrl and callbackSecret for webhook notifications
    if (context.data.callbackUrl !== undefined) {
      // Already set in data, will be saved by Sequelize
    }

    return context;
  };
};

const restrictFindToOwner = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    if (!context.params.user) {
      throw new NotAuthenticated('Authentication required');
    }

    context.params.query = {
      ...context.params.query,
      userId: context.params.user.id,
    };

    return context;
  };
};

const handlePatch = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    // Mobile flow: authenticate via session token (no JWT needed)
    const sessionToken = context.params.headers?.['x-session-token'];
    if (sessionToken) {
      const sequelize = context.app.get('sequelizeClient');
      const session = await sequelize.models.verification_sessions.findOne({
        where: { token: sessionToken },
        raw: true,
      });

      if (!session) {
        throw new Forbidden('Invalid session token');
      }

      if (new Date(session.expiresAt) < new Date()) {
        throw new BadRequest('Session has expired');
      }

      // Force the patch to target this session
      context.id = session.id;

      // Only allow updating URLs and status from mobile
      const allowed = ['idFrontUrl', 'idBackUrl', 'selfieUrl', 'status'];
      const sanitized: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in context.data) {
          sanitized[key] = context.data[key];
        }
      }
      context.data = sanitized;

      return context;
    }

    // Desktop flow: JWT auth, restrict to own sessions
    if (!context.params.user) {
      throw new NotAuthenticated('Authentication required');
    }

    const session = await context.service.get(context.id!);
    if (String(session.userId) !== String(context.params.user.id)) {
      throw new Forbidden('Not your session');
    }

    return context;
  };
};

export default {
  before: {
    all: [],
    find: [authenticate('jwt'), restrictFindToOwner()],
    get: [authenticate('jwt'), restrictFindToOwner()],
    create: [authenticateApiKeyOrJwt(), generateSessionToken()],
    update: [disallow('external')],
    patch: [handlePatch()],
    remove: [disallow('external')],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
} as HooksObject;
