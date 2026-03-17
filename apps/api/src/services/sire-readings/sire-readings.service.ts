import type { Application, SireReading, ServiceMethods } from '../../declarations';
import { SireReadings } from './sire-readings.class';
import createModel from '../../models/sire-readings.model';
import hooks from './sire-readings.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'sire-readings': ServiceMethods<SireReading>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/sire-readings', new SireReadings(options, app));

  const service = app.service('sire-readings');
  service.hooks(hooks);
}
