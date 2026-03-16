import { Hook, HookContext } from '@feathersjs/feathers';
import { getClientIp, getClientInfo } from './log-access';

const SKIP_SERVICES = ['authentication', 'access-logs'];

export const logAccessDenial = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const error = context.error;
    if (!error) return context;

    const code = error.code;
    if (code !== 401 && code !== 403) return context;

    // Skip services that handle their own auth logging or could cause recursion
    if (SKIP_SERVICES.includes(context.path)) return context;

    const ip = getClientIp(context);
    const clientInfo = getClientInfo(context);

    context.app.service('access-logs').create({
      userId: context.params.user?.id ? String(context.params.user.id) : null,
      organizationId: context.params.organizationId || null,
      resource: 'access-control',
      patientId: null,
      action: 'deny',
      purpose: 'operations',
      ip,
      metadata: {
        service: context.path,
        method: context.method,
        errorCode: code,
        errorMessage: error.message,
        ...clientInfo,
      },
    }).catch(() => {});

    return context;
  };
};
