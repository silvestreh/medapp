import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, PersonalData as PersonalDataInterface } from '../../declarations';

export class PersonalData extends Service<PersonalDataInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
