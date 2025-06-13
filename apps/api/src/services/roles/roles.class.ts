import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Role } from '../../declarations';

export class Roles extends Service<Role> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
