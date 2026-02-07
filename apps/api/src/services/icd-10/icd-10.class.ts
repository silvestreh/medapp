import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Icd10 } from '../../declarations';

export class Icd10Service extends Service<Icd10> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
