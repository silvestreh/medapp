import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const blockSuperAdmin = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.isSuperAdmin) {
      throw new Forbidden('SuperAdmin cannot access health information');
    }
    return context;
  };
};
