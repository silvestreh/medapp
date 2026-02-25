import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { PractitionerVerification } from './practitioner-verification.class';
import hooks from './practitioner-verification.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'practitioner-verification': PractitionerVerification & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  // Initialize our service with any options it requires
  app.use('/practitioner-verification', new PractitionerVerification(app));

  // Get our initialized service so that we can register hooks
  const service = app.service('practitioner-verification');

  service.hooks(hooks);
}
