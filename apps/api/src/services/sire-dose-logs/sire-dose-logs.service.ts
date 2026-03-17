import type { Application, SireDoseLog, ServiceMethods } from '../../declarations';
import { SireDoseLogs } from './sire-dose-logs.class';
import createModel from '../../models/sire-dose-logs.model';
import hooks from './sire-dose-logs.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'sire-dose-logs': ServiceMethods<SireDoseLog>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/sire-dose-logs', new SireDoseLogs(options, app));

  const service = app.service('sire-dose-logs');
  service.hooks(hooks);
}
