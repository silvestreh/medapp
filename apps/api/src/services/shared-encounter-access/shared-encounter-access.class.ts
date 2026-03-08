import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, SharedEncounterAccess } from '../../declarations';

export class SharedEncounterAccessService extends Service<SharedEncounterAccess> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
