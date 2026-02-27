import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, AccountingSettings as AccountingSettingsInterface } from '../../declarations';

export class AccountingSettings extends Service<AccountingSettingsInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
