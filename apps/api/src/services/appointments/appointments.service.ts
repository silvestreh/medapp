// Initializes the `appointments` service on path `/appointments`
import type { Application, Appointment, ServiceMethods } from '../../declarations';
import { Appointments } from './appointments.class';
import createModel from '../../models/appointments.model';
import hooks from './appointments.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'appointments': ServiceMethods<Appointment>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    multi: ['patch'],
  };

  // Initialize our service with any options it requires
  app.use('/appointments', new Appointments(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('appointments');

  service.hooks(hooks);
}
