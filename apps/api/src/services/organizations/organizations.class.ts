import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Organization } from '../../declarations';

export class Organizations extends Service<Organization> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
