import { Hook, HookContext } from '@feathersjs/feathers';

export const setGrantingMedic = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    context.data = {
      ...context.data,
      grantingMedicId: params.user.id,
      organizationId: params.organizationId
    };

    return context;
  };
};
