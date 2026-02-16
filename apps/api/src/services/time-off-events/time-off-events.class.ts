import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, TimeOffEvent } from '../../declarations';

export class TimeOffEvents extends Service<TimeOffEvent> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
