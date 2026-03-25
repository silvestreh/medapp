import { Hook, HookContext } from '@feathersjs/feathers';
import { getClientIp, getClientInfo } from './log-access';

export const logAuthSuccess = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const userId = context.result?.user?.id;
    if (!userId) return context;

    const ip = getClientIp(context);
    const clientInfo = getClientInfo(context);
    const strategy = context.data?.strategy || 'unknown';

    // JWT authentications are token validations, not actual logins — skip logging
    if (strategy === 'jwt') return context;

    context.app.service('access-logs').create({
      userId: String(userId),
      organizationId: null,
      resource: 'authentication',
      patientId: null,
      action: 'login',
      purpose: 'operations',
      ip,
      metadata: {
        strategy,
        ...clientInfo,
      },
    }).catch(() => {});

    return context;
  };
};

export const logAuthFailure = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const ip = getClientIp(context);
    const clientInfo = getClientInfo(context);
    const strategy = context.data?.strategy || 'unknown';
    const attemptedUsername = context.data?.username || null;

    context.app.service('access-logs').create({
      userId: null,
      organizationId: null,
      resource: 'authentication',
      patientId: null,
      action: 'deny',
      purpose: 'operations',
      ip,
      metadata: {
        strategy,
        error: context.error?.message || 'Authentication failed',
        ...(attemptedUsername ? { attemptedUsername } : {}),
        ...clientInfo,
      },
    }).catch(() => {});

    return context;
  };
};
