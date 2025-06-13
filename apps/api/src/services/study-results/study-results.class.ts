import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, StudyResult } from '../../declarations';

export class StudyResults extends Service<StudyResult> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
