import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, User } from '../../declarations';

export class Users extends Service<User> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
