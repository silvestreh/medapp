import { Hook, HookContext } from '@feathersjs/feathers';
import { getUserPermissions } from '../../../utils/get-user-permissions';
import logger from '../../../logger';

export const setUserId = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.provider || !context.params.user) return context;

    const requestedUserId = context.data?.userId;
    const currentUserId = context.params.user.id;
    const organizationId = context.params.organizationId;

    logger.debug(
      '[practice-codes:set-user-id] entry requestedUserId=%s currentUserId=%s organizationId=%s',
      requestedUserId,
      currentUserId,
      organizationId
    );

    // If creating for another user, verify access
    if (requestedUserId && requestedUserId !== currentUserId) {
      const permissions = await getUserPermissions(context.app, currentUserId, organizationId);
      const hasAccountingFind = permissions.includes('accounting:find');
      logger.debug(
        '[practice-codes:set-user-id] permission-check hasAccountingFind=%s permissions=%j',
        hasAccountingFind,
        permissions
      );
      if (hasAccountingFind) return context;

      const delegations = await context.app.service('prescription-delegations').find({
        query: { medicId: requestedUserId, prescriberId: currentUserId, $limit: 1 },
        paginate: false,
      });
      const delegationCount = Array.isArray(delegations) ? delegations.length : 0;
      logger.debug(
        '[practice-codes:set-user-id] delegation-check medicId=%s prescriberId=%s delegationCount=%d',
        requestedUserId,
        currentUserId,
        delegationCount
      );
      if (delegationCount > 0) return context;
    }

    logger.debug(
      '[practice-codes:set-user-id] swapping effectiveUserId=%s (was requested=%s)',
      currentUserId,
      requestedUserId
    );
    context.data = {
      ...context.data,
      userId: currentUserId,
    };
    return context;
  };
};
