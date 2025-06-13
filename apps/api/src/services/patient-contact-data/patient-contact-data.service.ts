// Initializes the `patient-contact-data` service on path `/patient-contact-data`
import { Application, PatientContactData as PatientContactDataInterface, ServiceMethods } from '../../declarations';
import { PatientContactData } from './patient-contact-data.class';
import createModel from '../../models/patient-contact-data.model';
import hooks from './patient-contact-data.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'patient-contact-data': ServiceMethods<PatientContactDataInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/patient-contact-data', new PatientContactData(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('patient-contact-data');

  service.hooks(hooks);
}
