import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow, iff, isProvider } from 'feathers-hooks-common';
import { BadRequest, Forbidden } from '@feathersjs/errors';
import { decryptJson } from '../../encryption';
import { runAutomatedChecks } from './hooks/run-automated-checks';
import { notifyMainApi } from './hooks/notify-main-api';
import { cleanupFiles } from './hooks/cleanup-files';

const { authenticate } = authentication.hooks;

const restrictToOwnerOrInternal = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    if (!context.params.user) {
      throw new Forbidden('Authentication required');
    }

    // Restrict external callers to their own records
    context.params.query = {
      ...context.params.query,
      userId: context.params.user.id,
    };

    return context;
  };
};

const validateCreate = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    const { idFrontUrl, idBackUrl, selfieUrl } = context.data;
    if (!idFrontUrl || !idBackUrl || !selfieUrl) {
      throw new BadRequest('ID front photo, ID back photo, and selfie are all required');
    }

    const user = context.params.user;
    if (!user) {
      throw new Forbidden('Authentication required');
    }

    context.data.userId = user.id;
    context.data.status = 'pending';
    context.data.verifiedAt = null;
    context.data.verifiedBy = null;
    context.data.notes = null;
    context.data.rejectionReason = null;

    return context;
  };
};

const decryptDniScanData = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const decryptItem = (item: Record<string, unknown>): void => {
      if (typeof item.dniScanData === 'string') {
        try {
          item.dniScanData = decryptJson(item.dniScanData);
        } catch {
          item.dniScanData = null;
        }
      }
    };

    const result = context.result;
    if (!result) return context;

    if (result.data && Array.isArray(result.data)) {
      result.data.forEach(decryptItem);
    } else if (Array.isArray(result)) {
      result.forEach(decryptItem);
    } else {
      decryptItem(result);
    }

    return context;
  };
};

const sanitizePatch = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.provider === undefined) return context;

    // External callers can only patch specific fields
    const allowed = ['status', 'notes', 'rejectionReason', 'verifiedAt', 'verifiedBy'];
    const sanitized: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in context.data) {
        sanitized[key] = context.data[key];
      }
    }
    context.data = sanitized;

    return context;
  };
};

export default {
  before: {
    all: [iff(isProvider('external'), authenticate('jwt'))],
    find: [restrictToOwnerOrInternal()],
    get: [restrictToOwnerOrInternal()],
    create: [validateCreate()],
    update: [disallow('external')],
    patch: [sanitizePatch()],
    remove: [disallow('external')],
  },

  after: {
    all: [decryptDniScanData()],
    find: [],
    get: [],
    create: [runAutomatedChecks()],
    update: [],
    patch: [notifyMainApi(), cleanupFiles()],
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
