import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import { Application, AppointmentPayment as AppointmentPaymentInterface } from '../../declarations';

export class AppointmentPayments extends Service<AppointmentPaymentInterface> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
