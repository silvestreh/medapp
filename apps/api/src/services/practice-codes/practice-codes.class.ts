import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, PracticeCode } from '../../declarations';

export class PracticeCodesService extends Service<PracticeCode> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
