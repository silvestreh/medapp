import type { Application } from '../../declarations';
import { SirePushTokens } from './sire-push-tokens.class';
import createModel from '../../models/sire-push-tokens.model';
import hooks from './sire-push-tokens.hooks';

export default function (app: Application): void {
  createModel(app);

  app.use('/sire-push-tokens', new SirePushTokens(app) as any);

  const service = app.service('sire-push-tokens');
  (service as any).hooks(hooks);
}
