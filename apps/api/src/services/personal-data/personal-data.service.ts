// Initializes the `personal-data` service on path `/personal-data`
import type { ServiceMethods } from '@feathersjs/feathers';
import type { Application, PersonalData as PersonalDataInterface } from '../../declarations';
import { PersonalData } from './personal-data.class';
import createModel from '../../models/personal-data.model';
import hooks from './personal-data.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'personal-data': ServiceMethods<PersonalDataInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['remove']
  };

  // Initialize our service with any options it requires
  app.use('/personal-data', new PersonalData(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('personal-data');

  service.hooks(hooks);
}
