import { Application } from '../../declarations';
import createModel from '../../models/messages.model';
import { Messages } from './messages.class';
import hooks from './messages.hooks';

export default function (app: Application): void {
  const Model = createModel(app);
  const paginate = app.get('paginate');

  const options = {
    Model,
    paginate,
  };

  app.use('/messages', new Messages(options));
  app.service('messages').hooks(hooks);
}
