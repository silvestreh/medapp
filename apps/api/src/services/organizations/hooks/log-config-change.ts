import { Hook, HookContext } from '@feathersjs/feathers';
import { getClientIp, getClientInfo } from '../../../hooks/log-access';

export const logConfigChange = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    // Only log external (user-initiated) requests
    if (!context.params.provider) return context;

    const userId = context.params.user?.id;
    if (!userId) return context;

    const ip = getClientIp(context);
    const clientInfo = getClientInfo(context);
    const changedFields = context.data ? Object.keys(context.data) : [];

    context.app.service('access-logs').create({
      userId: String(userId),
      organizationId: context.result?.id ? String(context.result.id) : null,
      resource: 'configuration',
      patientId: null,
      action: 'write',
      purpose: 'operations',
      ip,
      metadata: {
        changedFields,
        ...clientInfo,
      },
    }).catch(() => {});

    return context;
  };
};
