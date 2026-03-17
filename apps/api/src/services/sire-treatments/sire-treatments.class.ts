import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SireTreatment } from '../../declarations';

export class SireTreatments extends Service<SireTreatment> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
