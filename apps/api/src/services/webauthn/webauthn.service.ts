import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { WebAuthn } from './webauthn.class';
import hooks from './webauthn.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    webauthn: WebAuthn & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/webauthn', new WebAuthn(app));

  const service = app.service('webauthn');
  service.hooks(hooks);
}
