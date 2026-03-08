import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, AccessLog } from '../../declarations';
import { AccessLogs } from './access-logs.class';
import createModel from '../../models/access-logs.model';
import hooks from './access-logs.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'access-logs': AccessLogs & ServiceAddons<AccessLog>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/access-logs', new AccessLogs(options, app));

  const service = app.service('access-logs');
  service.hooks(hooks);
}
