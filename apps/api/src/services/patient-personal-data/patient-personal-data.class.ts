import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application, PatientPersonalData as PatientPersonalDataInterface } from '../../declarations';

export class PatientPersonalData extends Service<PatientPersonalDataInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
