import { Hook, HookContext } from '@feathersjs/feathers';

/**
 * before find: non-super-admin users only see organizations they belong to.
 * after get: non-members get a minimal public shape (id, name, slug) — the
 * invite-acceptance flow loads the inviting organization's name before the
 * user becomes a member, so get cannot be blocked outright, but settings and
 * config must not leak.
 */
const restrictOrgReads = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, params } = context;

  if (params.provider === undefined || !params.user) return context;
  if (params.user.isSuperAdmin) return context;

  const memberships = (await app.service('organization-users').find({
    query: { userId: params.user.id },
    paginate: false,
  })) as any[];
  const memberOrgIds = memberships.map((membership) => String(membership.organizationId));

  if (context.type === 'before' && context.method === 'find') {
    context.params.query = {
      ...context.params.query,
      id: { $in: memberOrgIds },
    };
    return context;
  }

  if (context.type === 'after' && context.method === 'get' && context.result) {
    if (!memberOrgIds.includes(String(context.result.id))) {
      const { id, name, slug } = context.result;
      context.result = { id, name, slug };
    }
    return context;
  }

  return context;
};

export default restrictOrgReads;
