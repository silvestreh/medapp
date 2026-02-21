import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, OrganizationPatient } from '../../declarations';

export class OrganizationPatients extends Service<OrganizationPatient> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
