import { Hook, HookContext } from '@feathersjs/feathers';
import { getClientIp, getClientInfo } from '../../../hooks/log-access';

export const logRoleChange = (changeType: 'assign' | 'revoke'): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    // Only log external (user-initiated) requests
    if (!context.params.provider) return context;

    const userId = context.params.user?.id;
    if (!userId) return context;

    const result = context.result;
    if (!result) return context;

    const ip = getClientIp(context);
    const clientInfo = getClientInfo(context);

    context.app.service('access-logs').create({
      userId: String(userId),
      organizationId: result.organizationId ? String(result.organizationId) : null,
      resource: 'user-management',
      patientId: null,
      action: 'write',
      purpose: 'operations',
      ip,
      metadata: {
        targetUserId: result.userId ? String(result.userId) : null,
        roleId: result.roleId || null,
        changeType,
        ...clientInfo,
      },
    }).catch(() => {});

    return context;
  };
};
