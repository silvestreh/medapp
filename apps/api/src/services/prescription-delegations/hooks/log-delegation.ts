import { Hook, HookContext } from '@feathersjs/feathers';
import { getClientIp, getClientInfo } from '../../../hooks/log-access';

export const logDelegation = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const result = context.result;
    if (!result) return context;

    const ip = getClientIp(context);
    const clientInfo = getClientInfo(context);
    const action = context.method === 'remove' ? 'revoke' : 'grant';

    // Fire and forget — access logging should never break the main request
    context.app.service('access-logs').create({
      userId: String(result.medicId),
      organizationId: result.organizationId || null,
      resource: 'prescriptions',
      action,
      purpose: 'operations',
      ip,
      metadata: {
        ...clientInfo,
        prescriberId: result.prescriberId,
      },
    }).catch(() => { /* best-effort */ });

    return context;
  };
};
