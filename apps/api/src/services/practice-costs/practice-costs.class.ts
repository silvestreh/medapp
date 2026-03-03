import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, PracticeCost } from '../../declarations';

export class PracticeCosts extends Service<PracticeCost> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
