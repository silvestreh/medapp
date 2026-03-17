import type { Application, SireDoseSchedule, ServiceMethods } from '../../declarations';
import { SireDoseSchedules } from './sire-dose-schedules.class';
import createModel from '../../models/sire-dose-schedules.model';
import hooks from './sire-dose-schedules.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'sire-dose-schedules': ServiceMethods<SireDoseSchedule>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/sire-dose-schedules', new SireDoseSchedules(options, app));

  const service = app.service('sire-dose-schedules');
  service.hooks(hooks);
}
