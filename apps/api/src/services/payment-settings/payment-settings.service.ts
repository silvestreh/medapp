import type { Application, PaymentSettings as PaymentSettingsInterface, ServiceMethods } from '../../declarations';
import { PaymentSettings } from './payment-settings.class';
import createModel from '../../models/payment-settings.model';
import hooks from './payment-settings.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'payment-settings': ServiceMethods<PaymentSettingsInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/payment-settings', new PaymentSettings(options, app));

  const service = app.service('payment-settings');

  service.hooks(hooks);
}
