import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow, iff, isProvider } from 'feathers-hooks-common';
import { Forbidden } from '@feathersjs/errors';

const { authenticate } = authentication.hooks;

const requireSuperAdmin = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.isSuperAdmin) {
      throw new Forbidden('Only super admins can verify access log chains');
    }
    return context;
  };
};

export default {
  before: {
    all: [iff(isProvider('external'), authenticate('jwt'))],
    find: [iff(isProvider('external'), requireSuperAdmin())],
    get: [disallow('external')],
    create: [disallow('external')],
    update: [disallow('external')],
    patch: [disallow('external')],
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
