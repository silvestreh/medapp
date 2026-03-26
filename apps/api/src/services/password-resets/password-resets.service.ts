import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { PasswordResets, PasswordReset } from './password-resets.class';
import createModel from '../../models/password-resets.model';
import hooks from './password-resets.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'password-resets': PasswordResets & ServiceAddons<PasswordReset>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/password-resets', new PasswordResets(options, app));

  const service = app.service('password-resets');
  service.hooks(hooks);
}
