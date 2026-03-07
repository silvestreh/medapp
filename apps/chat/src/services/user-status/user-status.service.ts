import { Application } from '../../declarations';
import createModel from '../../models/user-status.model';
import { UserStatusService } from './user-status.class';
import hooks from './user-status.hooks';

export default function (app: Application): void {
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    Model,
    paginate,
  };

  app.use('/user-status', new UserStatusService(options));
  app.service('user-status').hooks(hooks);
}
