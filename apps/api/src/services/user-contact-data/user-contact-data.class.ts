import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application, UserContactData as UserContactDataInterface } from '../../declarations';

export class UserContactData extends Service<UserContactDataInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
