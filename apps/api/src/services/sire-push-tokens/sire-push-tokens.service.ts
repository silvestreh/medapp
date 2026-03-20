import type { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { SirePushTokens } from './sire-push-tokens.class';
import createModel from '../../models/sire-push-tokens.model';
import hooks from './sire-push-tokens.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'sire-push-tokens': SirePushTokens & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  createModel(app);

  app.use('/sire-push-tokens', new SirePushTokens(app) as any);

  const service = app.service('sire-push-tokens');
  (service as any).hooks(hooks);
}
