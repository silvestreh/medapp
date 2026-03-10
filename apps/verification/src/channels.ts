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
    const userId = authResult?.user?.id;
    logger.info('[channels] login — userId:', userId);

    (app as any).channel('anonymous').leave(connection);
    (app as any).channel('authenticated').join(connection);

    if (userId) {
      (app as any).channel(`session/${userId}`).join(connection);
    }
  });

  (app as any).on('disconnect', (connection: any): void => {
    logger.info('[channels] disconnect');
  });

  // Route verification-sessions events to the user's session channel
  (app as any).service('verification-sessions').publish((_data: any, hook: HookContext) => {
    const userId = hook.result.userId;
    return (app as any).channel(`session/${userId}`);
  });
}
