import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application } from '../../declarations';

export class Laboratories extends Service {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
