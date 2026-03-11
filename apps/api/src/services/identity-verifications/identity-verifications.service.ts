import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, IdentityVerification } from '../../declarations';
import { IdentityVerifications } from './identity-verifications.class';
import hooks from './identity-verifications.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'identity-verifications': IdentityVerifications & ServiceAddons<IdentityVerification>;
  }
}

export default function (app: Application): void {
  app.use('/identity-verifications', new IdentityVerifications(app));

  const service = app.service('identity-verifications');
  service.hooks(hooks);
}
