import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { PatientOtp } from './patient-otp.class';
import hooks from './patient-otp.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'patient-otp': PatientOtp & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/patient-otp', new PatientOtp(app));

  const service = app.service('patient-otp');
  service.hooks(hooks);
}
