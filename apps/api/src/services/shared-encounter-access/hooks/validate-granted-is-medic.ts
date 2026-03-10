import { BadRequest } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';

export const validateGrantedIsMedic = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, data } = context;

    if (!data?.grantedMedicId) {
      return context;
    }

    const organizationId = data.organizationId || context.params.organizationId;

    const roles = await app.service('user-roles').find({
      query: {
        userId: data.grantedMedicId,
        roleId: 'medic',
        organizationId,
        $limit: 1,
      },
      paginate: false,
    });

    if (!roles.length) {
      throw new BadRequest('Access can only be shared with medics');
    }

    return context;
  };
};
