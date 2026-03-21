import { Hook, HookContext } from '@feathersjs/feathers';

export const scopeToOrganization = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (params.provider === undefined || !params.organizationId) {
      return context;
    }

    context.params.query = {
      ...context.params.query,
      organizationId: params.organizationId,
    };

    return context;
  };
};
