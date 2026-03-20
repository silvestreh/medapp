import type { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { PatientRefreshTokens } from './patient-refresh-tokens.class';
import createModel from '../../models/patient-refresh-tokens.model';

declare module '../../declarations' {
  interface ServiceTypes {
    'patient-refresh-tokens': PatientRefreshTokens & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  createModel(app);

  app.use('/patient-refresh-tokens', new PatientRefreshTokens(app) as any);
}
