import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { PasskeyCredentials, PasskeyCredential } from './passkey-credentials.class';
import createModel from '../../models/passkey-credentials.model';
import hooks from './passkey-credentials.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'passkey-credentials': PasskeyCredentials & ServiceAddons<PasskeyCredential>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/passkey-credentials', new PasskeyCredentials(options, app));

  const service = app.service('passkey-credentials');
  service.hooks(hooks);
}
