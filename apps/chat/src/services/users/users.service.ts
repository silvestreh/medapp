import { Application } from '../../declarations';
import { Users } from './users.class';

export default function (app: Application): void {
  app.use('/users', new Users(app));
}
