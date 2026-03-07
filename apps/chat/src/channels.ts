import '@feathersjs/transport-commons';
import { HookContext } from '@feathersjs/feathers';
import { Application } from './declarations';
import logger from './logger';

export default function (app: Application): void {
  if (typeof (app as any).channel !== 'function') {
    return;
  }

  (app as any).on('connection', (connection: any): void => {
    logger.info('[channels] new connection');
    (app as any).channel('anonymous').join(connection);
  });

  (app as any).on('login', async (authResult: any, { connection }: any): Promise<void> => {
    if (!connection) return;
    logger.info('[channels] login — userId:', authResult?.user?.id);

    (app as any).channel('anonymous').leave(connection);
    (app as any).channel('authenticated').join(connection);

    const user = connection.user;
    if (!user) return;

    // Join user to their conversation channels
    try {
      const sequelize = app.get('sequelizeClient');
      const ConversationParticipants = sequelize.models.conversation_participants;

      const memberships = await ConversationParticipants.findAll({
        where: { userId: user.id },
        attributes: ['conversationId'],
        raw: true,
      });

      memberships.forEach((m: any) => {
        (app as any).channel(`conversations/${m.conversationId}`).join(connection);
      });
    } catch (err) {
      logger.error('Error joining conversation channels on login:', err);
    }

    // Set user status on login — restore previous status if it exists, default to online
    try {
      const userStatusService = app.service('user-status') as any;
      const existing = await userStatusService.find({
        query: { userId: user.id },
        paginate: false,
        provider: undefined,
      });

      if (existing.length > 0) {
        // Restore previous status (away/dnd stay as-is), only change offline → online
        const restoredStatus = existing[0].status === 'offline' ? 'online' : existing[0].status;
        await userStatusService.patch(
          existing[0].id,
          { status: restoredStatus, lastSeenAt: new Date() },
          { provider: undefined },
        );
      } else {
        await userStatusService.create(
          { userId: user.id, status: 'online', lastSeenAt: new Date() },
          { provider: undefined },
        );
      }
    } catch (err) {
      logger.error('Error setting user status on login:', err);
    }
  });

  (app as any).on('disconnect', async (connection: any): Promise<void> => {
    const user = connection.user;
    if (!user) return;

    // Set user status to offline
    try {
      const userStatusService = app.service('user-status') as any;
      const existing = await userStatusService.find({
        query: { userId: user.id },
        paginate: false,
        provider: undefined,
      });

      if (existing.length > 0) {
        await userStatusService.patch(
          existing[0].id,
          { status: 'offline', lastSeenAt: new Date() },
          { provider: undefined },
        );
      }
    } catch (err) {
      logger.error('Error setting user status on disconnect:', err);
    }
  });

  // Route message events to conversation channels
  (app as any).service('messages').publish((_data: any, hook: HookContext) => {
    return (app as any).channel(`conversations/${hook.result.conversationId}`);
  });

  // Route conversation events to conversation channels
  (app as any).service('conversations').publish((_data: any, hook: HookContext) => {
    return (app as any).channel(`conversations/${hook.result.id}`);
  });

  // Route user-status events to all authenticated users
  (app as any).service('user-status').publish(() => {
    return (app as any).channel('authenticated');
  });
}
