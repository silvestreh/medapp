import '@feathersjs/transport-commons';
import { HookContext } from '@feathersjs/feathers';
import { Application } from './declarations';

type RealtimeApplication = Application & {
  channel: (...names: string[]) => {
    join: (...connections: any[]) => void;
    leave: (...connections: any[]) => void;
  };
  publish: (publisher: (data: any, hook: HookContext) => any) => any;
};

function hasRealtime(app: Application): app is RealtimeApplication {
  return typeof (app as any).channel === 'function' && typeof (app as any).publish === 'function';
}

export default function(app: Application): void {
  if(!hasRealtime(app)) {
    return;
  }

  app.on('connection', (connection: any): void => {
    app.channel('anonymous').join(connection);
  });

  app.on('login', (authResult: any, { connection }: any): void => {
    if (connection) {
      app.channel('anonymous').leave(connection);
      app.channel('authenticated').join(connection);

      const user = connection.user;
      if (user) {
        (app.service('organization-users').find({
          query: { userId: user.id },
          paginate: false
        } as any) as Promise<any[]>).then((memberships) => {
          memberships.forEach((m: any) => {
            app.channel(`organizations/${m.organizationId}`).join(connection);
          });
        }).catch(() => {
          // If org lookup fails, user stays in authenticated channel only
        });
      }
    }
  });

  app.publish((data: any, hook: HookContext) => {
    if (data.organizationId) {
      return app.channel(`organizations/${data.organizationId}`);
    }

    return app.channel('authenticated');
  });
}
