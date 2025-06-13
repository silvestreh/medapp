import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Study } from '../../declarations';

export class Studies extends Service<Study> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
