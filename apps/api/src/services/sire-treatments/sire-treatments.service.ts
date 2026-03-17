import type { Application, SireTreatment, ServiceMethods } from '../../declarations';
import { SireTreatments } from './sire-treatments.class';
import createModel from '../../models/sire-treatments.model';
import hooks from './sire-treatments.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'sire-treatments': ServiceMethods<SireTreatment>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/sire-treatments', new SireTreatments(options, app));

  const service = app.service('sire-treatments');
  service.hooks(hooks);
}
