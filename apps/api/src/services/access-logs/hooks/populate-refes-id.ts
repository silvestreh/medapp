import { Hook, HookContext } from '@feathersjs/feathers';

export const populateRefesId = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const organizationId = context.data.organizationId;
    if (!organizationId) return context;

    try {
      const org = await context.app.service('organizations').get(organizationId, {
        provider: undefined
      });
      context.data.refesId = (org.settings as Record<string, any>)?.refesId || null;
    } catch {
      // Organization not found or inaccessible — leave refesId as null
      context.data.refesId = null;
    }

    return context;
  };
};
