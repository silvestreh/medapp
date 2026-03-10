import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, IdentityVerification } from '../../declarations';
import { IdentityVerifications } from './identity-verifications.class';
import createModel from '../../models/identity-verifications.model';
import hooks from './identity-verifications.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'identity-verifications': IdentityVerifications & ServiceAddons<IdentityVerification>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/identity-verifications', new IdentityVerifications(options, app));

  const service = app.service('identity-verifications');
  service.hooks(hooks);
}
