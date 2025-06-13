// Initializes the `contact-data` service on path `/contact-data`
import type { Application, ContactData as ContactDataInterface, ServiceMethods } from '../../declarations';
import { ContactData } from './contact-data.class';
import createModel from '../../models/contact-data.model';
import hooks from './contact-data.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'contact-data': ServiceMethods<ContactDataInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['remove']
  };

  // Initialize our service with any options it requires
  app.use('/contact-data', new ContactData(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('contact-data');

  service.hooks(hooks);
}
