import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, AppointmentReminder } from '../../declarations';

export class AppointmentReminders extends Service<AppointmentReminder> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
