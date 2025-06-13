import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Encounter } from '../../declarations';

export class Encounters extends Service<Encounter> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
