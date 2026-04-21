import { Hook, HookContext } from '@feathersjs/feathers';
import { canAccessOtherUser } from './can-access-other-user';
import logger from '../../../logger';

export const scopeToUser = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.provider || !context.params.user) return context;
    const currentUserId = context.params.user.id;

    logger.debug(
      '[practice-codes:scope-to-user] entry method=%s id=%s currentUserId=%s query=%j',
      context.method,
      context.id,
      currentUserId,
      context.params.query
    );

    // For operations by ID (get/patch/remove), check ownership of the record
    if (context.id && ['get', 'patch', 'remove'].includes(context.method)) {
      const sequelize = context.app.get('sequelizeClient');
      const record = await sequelize.models.practice_codes.findByPk(context.id, { raw: true });
      const canAccess = !!(record && await canAccessOtherUser(context, record.userId));
      logger.debug(
        '[practice-codes:scope-to-user] by-id recordFound=%s recordUserId=%s canAccess=%s',
        !!record,
        record?.userId,
        canAccess
      );
      if (canAccess) {
        // Remove any userId from query so feathers-sequelize finds the record by ID alone
        if (context.params.query?.userId) delete context.params.query.userId;
        return context;
      }
      context.params.query = { ...context.params.query, userId: currentUserId };
      logger.debug(
        '[practice-codes:scope-to-user] by-id scoped scopedUserId=%s',
        context.params.query.userId
      );
      return context;
    }

    // For find, check the requested userId
    const requestedUserId = context.params.query?.userId;
    if (requestedUserId && requestedUserId !== currentUserId) {
      const canAccess = await canAccessOtherUser(context, requestedUserId);
      logger.debug(
        '[practice-codes:scope-to-user] find requestedUserId=%s canAccess=%s',
        requestedUserId,
        canAccess
      );
      if (canAccess) return context;
      context.params.query = { ...context.params.query, userId: currentUserId };
      logger.debug(
        '[practice-codes:scope-to-user] find scoped scopedUserId=%s',
        context.params.query.userId
      );
      return context;
    }

    context.params.query = { ...context.params.query, userId: currentUserId };
    logger.debug(
      '[practice-codes:scope-to-user] default scoped scopedUserId=%s',
      context.params.query.userId
    );
    return context;
  };
};
