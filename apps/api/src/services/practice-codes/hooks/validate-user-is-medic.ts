import { BadRequest } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';
import logger from '../../../logger';

export const validateUserIsMedic = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.provider) return context;

    const userId = context.data?.userId;
    if (!userId) return context;

    const organizationId = context.params.organizationId;

    const roles = await context.app.service('user-roles').find({
      query: {
        userId,
        roleId: 'medic',
        organizationId,
        $limit: 1,
      },
      paginate: false,
    });

    logger.debug(
      '[practice-codes:validate-user-is-medic] userId=%s organizationId=%s matchedRoles=%d',
      userId,
      organizationId,
      roles.length
    );

    if (!roles.length) {
      throw new BadRequest('Practice codes can only be assigned to users with the medic role');
    }

    return context;
  };
};
