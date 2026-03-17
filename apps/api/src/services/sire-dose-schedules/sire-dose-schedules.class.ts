import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SireDoseSchedule } from '../../declarations';

export class SireDoseSchedules extends Service<SireDoseSchedule> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
