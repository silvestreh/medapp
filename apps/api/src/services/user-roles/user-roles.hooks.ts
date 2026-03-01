import { HooksObject } from '@feathersjs/feathers';
import { disallow } from 'feathers-hooks-common';
import { authenticate } from '@feathersjs/authentication';
import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { authorizeOrgManagement } from '../../hooks/authorize-org-management';

const scopeToOrganization = () => async (context: any) => {
  if (!context.params.provider || !context.params.organizationId) return context;

  if (context.method === 'find') {
    context.params.query = {
      ...context.params.query,
      organizationId: context.params.organizationId,
    };
  }

  if (context.method === 'create') {
    context.data = {
      ...context.data,
      organizationId: context.params.organizationId,
    };
  }

  return context;
};

export default {
  before: {
    all: [],
    find: [authenticate('jwt'), verifyOrganizationMembership(), scopeToOrganization()],
    get: [disallow('external')],
    create: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      authorizeOrgManagement(),
      scopeToOrganization(),
    ],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [
      authenticate('jwt'),
      verifyOrganizationMembership(),
      enforceActiveOrganization(),
      authorizeOrgManagement(),
    ],
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
