import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, Laboratory } from '../../declarations';
import { Laboratories } from './laboratories.class';
import createModel from '../../models/laboratories.model';
import hooks from './laboratories.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    laboratories: Laboratories & ServiceAddons<Laboratory>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['create']
  };

  // Initialize our service with any options it requires
  app.use('/laboratories', new Laboratories(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('laboratories');

  service.hooks(hooks);
}
