import { HooksObject } from '@feathersjs/feathers';
import * as authentication from '@feathersjs/authentication';
import { disallow } from 'feathers-hooks-common';

import { verifyOrganizationMembership } from '../../hooks/verify-organization-membership';
import { enforceActiveOrganization } from '../../hooks/enforce-active-organization';
import { checkPermissions } from '../../hooks/check-permissions';
import { getUserPermissions } from '../../utils/get-user-permissions';
// Don't remove this comment. It's needed to format import lines nicely.

const { authenticate } = authentication.hooks;

async function canAccessOtherUser(context: any, targetUserId: string): Promise<boolean> {
  const currentUserId = context.params.user.id;
  if (targetUserId === currentUserId) return true;

  const permissions = await getUserPermissions(context.app, currentUserId, context.params.organizationId);
  if (permissions.includes('accounting:find')) return true;

  const delegations = await context.app.service('prescription-delegations').find({
    query: { medicId: targetUserId, prescriberId: currentUserId, $limit: 1 },
    paginate: false,
  });
  return Array.isArray(delegations) && delegations.length > 0;
}

const scopeToUser = () => async (context: any) => {
  if (!context.params.provider || !context.params.user) return context;
  const currentUserId = context.params.user.id;

  // For operations by ID (get/patch/remove), check ownership of the record
  if (context.id && ['get', 'patch', 'remove'].includes(context.method)) {
    const sequelize = context.app.get('sequelizeClient');
    const record = await sequelize.models.practice_codes.findByPk(context.id, { raw: true });
    if (record && await canAccessOtherUser(context, record.userId)) {
      // Remove any userId from query so feathers-sequelize finds the record by ID alone
      if (context.params.query?.userId) delete context.params.query.userId;
      return context;
    }
    context.params.query = { ...context.params.query, userId: currentUserId };
    return context;
  }

  // For find, check the requested userId
  const requestedUserId = context.params.query?.userId;
  if (requestedUserId && requestedUserId !== currentUserId) {
    if (await canAccessOtherUser(context, requestedUserId)) return context;
    context.params.query = { ...context.params.query, userId: currentUserId };
    return context;
  }

  context.params.query = { ...context.params.query, userId: currentUserId };
  return context;
};

const setUserId = () => async (context: any) => {
  if (!context.params.provider || !context.params.user) return context;

  const requestedUserId = context.data?.userId;
  const currentUserId = context.params.user.id;

  // If creating for another user, verify access
  if (requestedUserId && requestedUserId !== currentUserId) {
    const permissions = await getUserPermissions(context.app, currentUserId, context.params.organizationId);
    if (permissions.includes('accounting:find')) return context;

    const delegations = await context.app.service('prescription-delegations').find({
      query: { medicId: requestedUserId, prescriberId: currentUserId, $limit: 1 },
      paginate: false,
    });
    if (Array.isArray(delegations) && delegations.length > 0) return context;
  }

  context.data = {
    ...context.data,
    userId: currentUserId,
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
