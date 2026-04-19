import { Hook, HookContext } from '@feathersjs/feathers';

export const setCreatedBy = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (params.provider === undefined) {
      return context;
    }

    context.data = {
      ...context.data,
      createdBy: params.user!.id,
    };

    return context;
  };
};
