import type { Application, ServiceMethods } from '../../declarations';
import { Prescriptions, Prescription } from './prescriptions.class';
import createModel from '../../models/prescriptions.model';
import hooks from './prescriptions.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'prescriptions': ServiceMethods<Prescription>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/prescriptions', new Prescriptions(options, app));

  const service = app.service('prescriptions');
  service.hooks(hooks);
}
