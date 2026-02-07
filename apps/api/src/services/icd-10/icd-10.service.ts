// Initializes the `icd-10` service on path `/icd-10`
import type { Application, ServiceMethods, Icd10 } from '../../declarations';
import { Icd10Service } from './icd-10.class';
import createModel from '../../models/icd-10.model';
import hooks from './icd-10.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'icd-10': ServiceMethods<Icd10>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['create']
  };

  // Initialize our service with any options it requires
  app.use('/icd-10', new Icd10Service(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('icd-10');

  service.hooks(hooks);
}
