import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Practice } from '../../declarations';

export class PracticesService extends Service<Practice> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
