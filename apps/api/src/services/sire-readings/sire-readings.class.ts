import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SireReading } from '../../declarations';

export class SireReadings extends Service<SireReading> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
