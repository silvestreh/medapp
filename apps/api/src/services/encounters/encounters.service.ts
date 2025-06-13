// Initializes the `encounters` service on path `/encounters`
import type { Application, Encounter, ServiceMethods } from '../../declarations';
import { Encounters } from './encounters.class';
import createModel from '../../models/encounters.model';
import hooks from './encounters.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'encounters': ServiceMethods<Encounter>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['patch'],
  };

  // Initialize our service with any options it requires
  app.use('/encounters', new Encounters(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('encounters');

  service.hooks(hooks);
}
