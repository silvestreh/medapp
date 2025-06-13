// Initializes the `user-personal-data` service on path `/user-personal-data`
import { Application, UserPersonalData as UserPersonalDataInterface, ServiceMethods } from '../../declarations';
import { UserPersonalData } from './user-personal-data.class';
import createModel from '../../models/user-personal-data.model';
import hooks from './user-personal-data.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'user-personal-data': ServiceMethods<UserPersonalDataInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/user-personal-data', new UserPersonalData(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('user-personal-data');

  service.hooks(hooks);
}
