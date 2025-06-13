import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, MdSettings as MdSettingsInterface } from '../../declarations';

export class MdSettings extends Service<MdSettingsInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
