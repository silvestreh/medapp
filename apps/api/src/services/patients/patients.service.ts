// Initializes the `patients` service on path `/patients`
import type { Application, ServiceMethods, Patient } from '../../declarations';
import { Patients } from './patients.class';
import createModel from '../../models/patients.model';
import hooks from './patients.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    patients: ServiceMethods<Patient>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/patients', new Patients(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('patients');

  service.hooks(hooks);
}
