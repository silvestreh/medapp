import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application, PatientContactData as PatientContactDataInterface } from '../../declarations';

export class PatientContactData extends Service<PatientContactDataInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
