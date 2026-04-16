import { Hook, HookContext } from '@feathersjs/feathers';
import { getUserPermissions } from '../../../utils/get-user-permissions';

export const setUserId = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
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
};
