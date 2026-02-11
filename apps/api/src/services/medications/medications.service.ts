import { Application } from '../../declarations';
import { Medications } from './medications.class';
import createModel from '../../models/medications.model';
import hooks from './medications.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'medications': Medications;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['create']
  };

  // Initialize our service with any options it requires
  app.use('/medications', new Medications(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('medications');

  service.hooks(hooks);
}
