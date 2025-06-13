// Initializes the `user-contact-data` service on path `/user-contact-data`
import { Application, UserContactData as UserContactDataInterface, ServiceMethods } from '../../declarations';
import { UserContactData } from './user-contact-data.class';
import createModel from '../../models/user-contact-data.model';
import hooks from './user-contact-data.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'user-contact-data': ServiceMethods<UserContactDataInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/user-contact-data', new UserContactData(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('user-contact-data');

  service.hooks(hooks);
}
