import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, AccessLog } from '../../declarations';

export class AccessLogs extends Service<AccessLog> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
