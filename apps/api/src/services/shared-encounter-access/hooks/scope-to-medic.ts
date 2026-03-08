import { Hook, HookContext } from '@feathersjs/feathers';

export const scopeToMedic = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    context.params.query = {
      ...context.params.query,
      $or: [
        { grantingMedicId: params.user.id },
        { grantedMedicId: params.user.id }
      ]
    };

    return context;
  };
};
