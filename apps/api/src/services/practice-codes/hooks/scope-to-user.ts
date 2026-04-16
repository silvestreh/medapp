import { Hook, HookContext } from '@feathersjs/feathers';
import { canAccessOtherUser } from './can-access-other-user';

export const scopeToUser = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.provider || !context.params.user) return context;
    const currentUserId = context.params.user.id;

    // For operations by ID (get/patch/remove), check ownership of the record
    if (context.id && ['get', 'patch', 'remove'].includes(context.method)) {
      const sequelize = context.app.get('sequelizeClient');
      const record = await sequelize.models.practice_codes.findByPk(context.id, { raw: true });
      if (record && await canAccessOtherUser(context, record.userId)) {
        // Remove any userId from query so feathers-sequelize finds the record by ID alone
        if (context.params.query?.userId) delete context.params.query.userId;
        return context;
      }
      context.params.query = { ...context.params.query, userId: currentUserId };
      return context;
    }

    // For find, check the requested userId
    const requestedUserId = context.params.query?.userId;
    if (requestedUserId && requestedUserId !== currentUserId) {
      if (await canAccessOtherUser(context, requestedUserId)) return context;
      context.params.query = { ...context.params.query, userId: currentUserId };
      return context;
    }

    context.params.query = { ...context.params.query, userId: currentUserId };
    return context;
  };
};
