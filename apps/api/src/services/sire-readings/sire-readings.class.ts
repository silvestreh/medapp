import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SireReading } from '../../declarations';

export class SireReadings extends Service<SireReading> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
