import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SigningCertificate } from '../../declarations';

export class SigningCertificates extends Service<SigningCertificate> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
