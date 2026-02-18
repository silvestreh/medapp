import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application } from '../../declarations';

export class Prepagas extends Service {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
