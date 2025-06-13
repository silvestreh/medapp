import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Appointment } from '../../declarations';

export class Appointments extends Service<Appointment> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
