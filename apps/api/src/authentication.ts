import { ServiceAddons } from '@feathersjs/feathers';
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication';
import { expressOauth } from '@feathersjs/authentication-oauth';

import { Application } from './declarations';
import { TwoFactorLocalStrategy } from './two-factor-local-strategy';

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

  app.service('authentication').hooks({
    before: {
      create: [
        (context: any) => {
          console.log('[auth] request: strategy =', context.data?.strategy, '| from:', context.params?.ip || context.params?.headers?.['x-forwarded-for'] || 'unknown');
        }
      ]
    },
    after: {
      create: [
        (context: any) => {
          console.log('[auth] success: strategy =', context.data?.strategy);
        }
      ]
    },
    error: {
      create: [
        (context: any) => {
          console.error('[auth] error: strategy =', context.data?.strategy, '| message:', context.error?.message);
        }
      ]
    }
  });

  app.configure(expressOauth());
}
