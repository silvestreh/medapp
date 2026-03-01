import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const enforceActiveOrganization = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.provider) {
      return context;
    }

    if (['find', 'get'].includes(context.method)) {
      return context;
    }

    if (context.params.isSuperAdmin) {
      return context;
    }

    if (context.params.isOrgActive === false) {
      throw new Forbidden('This organization is in read-only mode');
    }

    return context;
  };
};
