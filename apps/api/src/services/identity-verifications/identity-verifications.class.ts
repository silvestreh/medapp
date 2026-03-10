import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, IdentityVerification } from '../../declarations';

export class IdentityVerifications extends Service<IdentityVerification> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
