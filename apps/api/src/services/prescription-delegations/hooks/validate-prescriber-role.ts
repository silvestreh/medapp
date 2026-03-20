import { BadRequest } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';

export const validatePrescriberRole = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, data } = context;

    if (!data?.prescriberId) {
      return context;
    }

    const organizationId = data.organizationId || context.params.organizationId;

    const roles = await app.service('user-roles').find({
      query: {
        userId: data.prescriberId,
        roleId: 'prescriber',
        organizationId,
        $limit: 1,
      },
      paginate: false,
    });

    if (!roles.length) {
      throw new BadRequest('Delegation can only be granted to users with the prescriber role');
    }

    return context;
  };
};
