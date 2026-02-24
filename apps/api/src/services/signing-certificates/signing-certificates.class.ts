import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SigningCertificate } from '../../declarations';

export class SigningCertificates extends Service<SigningCertificate> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
