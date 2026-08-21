import type { Application, AppointmentPayment as AppointmentPaymentInterface, ServiceMethods } from '../../declarations';
import { AppointmentPayments } from './appointment-payments.class';
import createModel from '../../models/appointment-payments.model';
import createWebhookEventsModel from '../../models/payment-webhook-events.model';
import hooks from './appointment-payments.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'appointment-payments': ServiceMethods<AppointmentPaymentInterface>;
  }
}

export default function (app: Application): void {
  // payment_webhook_events has no service of its own — registered here for
  // its side effect so sequelize.sync() creates the table.
  createWebhookEventsModel(app);

  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['patch']
  };

  app.use('/appointment-payments', new AppointmentPayments(options, app));

  const service = app.service('appointment-payments');

  service.hooks(hooks);
}
