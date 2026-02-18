import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application } from '../../declarations';

interface UserRole {
  id: string;
  userId: string;
  roleId: string;
}

export class UserRoles extends Service<UserRole> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
