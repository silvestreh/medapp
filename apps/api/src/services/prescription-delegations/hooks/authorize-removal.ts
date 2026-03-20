import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const authorizeRemoval = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, id, params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    if (!id) {
      throw new Forbidden('ID is required for this operation');
    }

    const grant = await app.service('prescription-delegations').get(id, {
      ...params,
      provider: undefined
    });

    if (grant.medicId !== params.user.id) {
      throw new Forbidden('Only the granting medic can revoke this delegation');
    }

    return context;
  };
};
