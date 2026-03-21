import { Hook, HookContext } from '@feathersjs/feathers';

export const setOrganizationId = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (params.provider === undefined) {
      return context;
    }

    context.data = {
      ...context.data,
      organizationId: params.organizationId,
    };

    return context;
  };
};
