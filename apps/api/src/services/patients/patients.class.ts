import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Patient } from '../../declarations';

export class Patients extends Service<Patient> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
