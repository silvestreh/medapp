import { Hook, HookContext } from '@feathersjs/feathers';
import { getClientIp, getClientInfo } from '../../../hooks/log-access';

export const logShareAccess = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const result = context.result;
    if (!result) return context;

    const ip = getClientIp(context);
    const clientInfo = getClientInfo(context);

    // Fire and forget — access logging should never break the main request
    context.app.service('access-logs').create({
      userId: String(result.grantingMedicId),
      organizationId: result.organizationId || null,
      resource: 'shared-access',
      patientId: String(result.patientId),
      action: 'grant',
      purpose: 'share',
      ip,
      metadata: {
        ...clientInfo,
        grantedMedicId: result.grantedMedicId,
      },
    }).catch(() => { /* best-effort */ });

    return context;
  };
};
