import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { authorizeOrgManagement } from '../../hooks/authorize-org-management';
import populateMembers, { stripPopulateFlag } from './hooks/populate-members';
import filterByOrganizationId from './hooks/filter-by-organization-id';

const cascadeRemoveUserRoles = () => async (context: any) => {
  if (!context.result) return context;
  const membership = context.result;
  const userRoles = await context.app.service('user-roles').find({
    query: { userId: membership.userId, organizationId: membership.organizationId },
    paginate: false,
  } as any) as any[];
  for (const ur of userRoles) {
    await context.app.service('user-roles').remove(ur.id, { provider: undefined } as any);
  }
  return context;
};

const { authenticate } = authentication.hooks;

export default {
  before: {
    all: [authenticate('jwt'), verifyOrganizationMembership()],
    find: [stripPopulateFlag(), filterByOrganizationId()],
    get: [],
    create: [enforceActiveOrganization(), authorizeOrgManagement()],
    update: [],
    patch: [enforceActiveOrganization()],
    remove: [enforceActiveOrganization(), authorizeOrgManagement()]
  },

  after: {
    all: [],
    find: [populateMembers()],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [cascadeRemoveUserRoles()]
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
