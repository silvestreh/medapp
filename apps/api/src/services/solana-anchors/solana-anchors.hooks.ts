import { HooksObject, HookContext } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';
import { Forbidden } from '@feathersjs/errors';
import { disablePagination } from './hooks/disable-pagination';

const { authenticate } = authentication.hooks;

const requireSuperAdmin = () => async (context: HookContext): Promise<HookContext> => {
  if (!context.params.user?.isSuperAdmin) {
    throw new Forbidden('Only super admins can trigger anchoring');
  }
  return context;
};

export default {
  before: {
    all: [authenticate('jwt')],
    find: [disablePagination()],
    get: [],
    create: [requireSuperAdmin()],
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
