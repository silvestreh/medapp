import { Hook, HookContext, HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow, iff, isProvider } from 'feathers-hooks-common';
import { Forbidden } from '@feathersjs/errors';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';

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
    all: [iff(isProvider('external'), authenticate('jwt'), verifyOrganizationMembership())],
    find: [iff(isProvider('external'), requireSuperAdmin())],
    get: [iff(isProvider('external'), requireSuperAdmin())],
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
