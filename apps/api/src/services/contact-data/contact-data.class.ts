import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, ContactData as ContactDataInterface } from '../../declarations';

export class ContactData extends Service<ContactDataInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
