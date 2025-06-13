// Initializes the `patient-personal-data` service on path `/patient-personal-data`
import { Application, PatientPersonalData as PatientPersonalDataInterface, ServiceMethods } from '../../declarations';
import { PatientPersonalData } from './patient-personal-data.class';
import createModel from '../../models/patient-personal-data.model';
import hooks from './patient-personal-data.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'patient-personal-data': ServiceMethods<PatientPersonalDataInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/patient-personal-data', new PatientPersonalData(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('patient-personal-data');

  service.hooks(hooks);
}
