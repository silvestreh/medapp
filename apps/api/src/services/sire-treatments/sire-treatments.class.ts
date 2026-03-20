import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SireTreatment } from '../../declarations';

export class SireTreatments extends Service<SireTreatment> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
