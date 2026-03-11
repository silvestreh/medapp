import { Application } from '../../declarations';
import createModel from '../../models/identity-verifications.model';
import { IdentityVerifications } from './identity-verifications.class';
import hooks from './identity-verifications.hooks';

export default function (app: Application): void {
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    Model,
    paginate,
  };

  app.use('/identity-verifications', new IdentityVerifications(options));
  app.service('identity-verifications').hooks(hooks);
}
