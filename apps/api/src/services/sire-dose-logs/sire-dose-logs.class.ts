import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SireDoseLog } from '../../declarations';

export class SireDoseLogs extends Service<SireDoseLog> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
