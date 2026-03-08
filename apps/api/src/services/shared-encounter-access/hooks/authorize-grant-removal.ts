import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const authorizeGrantRemoval = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, id, params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    if (!id) {
      throw new Forbidden('ID is required for this operation');
    }

    const grant = await app.service('shared-encounter-access').get(id, {
      ...params,
      provider: undefined
    });

    if (grant.grantingMedicId !== params.user.id) {
      throw new Forbidden('Only the granting medic can revoke access');
    }

    return context;
  };
};
