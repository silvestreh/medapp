import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SireDoseSchedule } from '../../declarations';

export class SireDoseSchedules extends Service<SireDoseSchedule> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
