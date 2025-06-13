import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application, UserPersonalData as UserPersonalDataInterface } from '../../declarations';

export class UserPersonalData extends Service<UserPersonalDataInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
