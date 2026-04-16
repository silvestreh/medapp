import { HookContext } from '@feathersjs/feathers';
import { getUserPermissions } from '../../../utils/get-user-permissions';

export async function canAccessOtherUser(context: HookContext, targetUserId: string): Promise<boolean> {
  const currentUserId = context.params.user!.id;
  if (targetUserId === currentUserId) return true;

  const permissions = await getUserPermissions(context.app, currentUserId, context.params.organizationId);
  if (permissions.includes('accounting:find')) return true;

  const delegations = await context.app.service('prescription-delegations').find({
    query: { medicId: targetUserId, prescriberId: currentUserId, $limit: 1 },
    paginate: false,
  });
  return Array.isArray(delegations) && delegations.length > 0;
}
