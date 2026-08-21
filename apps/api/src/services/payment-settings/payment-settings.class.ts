import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application, PaymentSettings as PaymentSettingsInterface } from '../../declarations';

export class PaymentSettings extends Service<PaymentSettingsInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
