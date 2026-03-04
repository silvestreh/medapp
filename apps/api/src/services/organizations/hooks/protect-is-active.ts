import { Hook, HookContext } from '@feathersjs/feathers';

export const protectIsActive = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.params.isSuperAdmin) {
      return context;
    }

    if (context.data && 'isActive' in context.data) {
      delete context.data.isActive;
    }

    return context;
  };
};
