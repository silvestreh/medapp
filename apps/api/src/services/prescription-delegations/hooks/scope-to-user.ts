import { Hook, HookContext } from '@feathersjs/feathers';

export const scopeToUser = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    context.params.query = {
      ...context.params.query,
      $or: [
        { medicId: params.user.id },
        { prescriberId: params.user.id }
      ]
    };

    return context;
  };
};
