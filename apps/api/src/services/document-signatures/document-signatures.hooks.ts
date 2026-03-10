import { HooksObject, Hook, HookContext } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow, iff, isProvider } from 'feathers-hooks-common';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';

const { authenticate } = authentication.hooks;

const restrictToOwnRecords = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const user = context.params.user;
    if (user) {
      context.params.query = {
        ...context.params.query,
        signedById: user.id,
      };
    }
    return context;
  };
};

export default {
  before: {
    all: [iff(isProvider('external'), authenticate('jwt'), verifyOrganizationMembership())],
    find: [iff(isProvider('external'), restrictToOwnRecords())],
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
