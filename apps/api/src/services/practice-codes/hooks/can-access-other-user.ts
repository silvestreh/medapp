import { HookContext } from '@feathersjs/feathers';
import { getUserPermissions } from '../../../utils/get-user-permissions';
import logger from '../../../logger';

export async function canAccessOtherUser(context: HookContext, targetUserId: string): Promise<boolean> {
  const currentUserId = context.params.user!.id;
  const organizationId = context.params.organizationId;
  if (targetUserId === currentUserId) {
    logger.debug(
      '[practice-codes:can-access-other-user] same-user currentUserId=%s targetUserId=%s -> true',
      currentUserId,
      targetUserId
    );
    return true;
  }

  const permissions = await getUserPermissions(context.app, currentUserId, organizationId);
  const hasAccountingFind = permissions.includes('accounting:find');
  if (hasAccountingFind) {
    logger.debug(
      '[practice-codes:can-access-other-user] currentUserId=%s targetUserId=%s organizationId=%s hasAccountingFind=true -> true',
      currentUserId,
      targetUserId,
      organizationId
    );
    return true;
  }

  const delegations = await context.app.service('prescription-delegations').find({
    query: { medicId: targetUserId, prescriberId: currentUserId, $limit: 1 },
    paginate: false,
  });
  const delegationCount = Array.isArray(delegations) ? delegations.length : 0;
  const result = delegationCount > 0;
  logger.debug(
    '[practice-codes:can-access-other-user] currentUserId=%s targetUserId=%s organizationId=%s hasAccountingFind=false delegationCount=%d -> %s',
    currentUserId,
    targetUserId,
    organizationId,
    delegationCount,
    result
  );
  return result;
}
