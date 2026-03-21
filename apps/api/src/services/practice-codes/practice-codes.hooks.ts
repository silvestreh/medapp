import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { checkPermissions } from '../../hooks/check-permissions';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

const scopeToUser = () => async (context: any) => {
  if (!context.params.provider || !context.params.user) return context;
  context.params.query = {
    ...context.params.query,
    userId: context.params.user.id,
  };
  return context;
};

const setUserId = () => async (context: any) => {
  if (!context.params.provider || !context.params.user) return context;
  context.data = {
    ...context.data,
    userId: context.params.user.id,
  };
  return context;
};

export default {
  before: {
    all: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      checkPermissions({ scopeToOrganization: false })
    ],
    find: [scopeToUser()],
    get: [],
    create: [setUserId()],
    update: [disallow('external')],
    patch: [scopeToUser()],
    remove: [scopeToUser()]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
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
