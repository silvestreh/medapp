import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, OrganizationUser } from '../../declarations';

export class OrganizationUsers extends Service<OrganizationUser> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
