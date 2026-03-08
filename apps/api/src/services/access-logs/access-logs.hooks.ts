import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { Forbidden } from '@feathersjs/errors';

const { authenticate } = authentication.hooks;

const requireSuperAdmin = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.isSuperAdmin) {
      throw new Forbidden('Only super admins can access logs');
    }
    return context;
  };
};

export default {
  before: {
    all: [authenticate('jwt')],
    find: [requireSuperAdmin()],
    get: [requireSuperAdmin()],
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
