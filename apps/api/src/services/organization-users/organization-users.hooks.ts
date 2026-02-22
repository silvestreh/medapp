import { HooksObject, HookContext } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import populateMembers, { stripPopulateFlag } from './hooks/populate-members';

const { authenticate } = authentication.hooks;

const scopeToOrganization = () => async (context: HookContext): Promise<HookContext> => {
  const { params } = context;
  if (params.provider === undefined || !params.organizationId) return context;

  context.params.query = {
    ...context.params.query,
    organizationId: params.organizationId,
  };
  return context;
};

export default {
  before: {
    all: [authenticate('jwt'), verifyOrganizationMembership()],
    find: [stripPopulateFlag(), scopeToOrganization()],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [populateMembers()],
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
