import { ServiceAddons } from '@feathersjs/feathers';
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { expressOauth } from '@feathersjs/authentication-oauth';

import { Application } from './declarations';
import { TwoFactorLocalStrategy } from './two-factor-local-strategy';
import syncRecetarioUserId from './hooks/sync-recetario-user-id';

declare module './declarations' {
  interface ServiceTypes {
    'authentication': AuthenticationService & ServiceAddons<any>;
  }
}

export default function(app: Application): void {
  const authentication = new AuthenticationService(app);

  authentication.register('jwt', new JWTStrategy());
  authentication.register('local', new TwoFactorLocalStrategy());

  app.use('/authentication', authentication);
  app.configure(expressOauth());

  app.service('authentication').hooks({
    after: {
      create: [syncRecetarioUserId()],
    },
  });
}
