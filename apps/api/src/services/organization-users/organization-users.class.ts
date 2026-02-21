import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, OrganizationUser } from '../../declarations';

export class OrganizationUsers extends Service<OrganizationUser> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
