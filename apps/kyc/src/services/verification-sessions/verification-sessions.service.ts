import { Application } from '../../declarations';
import createModel from '../../models/verification-sessions.model';
import { VerificationSessions } from './verification-sessions.class';
import hooks from './verification-sessions.hooks';

export default function (app: Application): void {
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    Model,
    paginate,
  };

  app.use('/verification-sessions', new VerificationSessions(options));
  app.service('verification-sessions').hooks(hooks);
}
