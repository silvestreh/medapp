import type { Application, AccountingSettings as AccountingSettingsInterface, ServiceMethods } from '../../declarations';
import { AccountingSettings } from './accounting-settings.class';
import createModel from '../../models/accounting-settings.model';
import hooks from './accounting-settings.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'accounting-settings': ServiceMethods<AccountingSettingsInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/accounting-settings', new AccountingSettings(options, app));

  const service = app.service('accounting-settings');

  service.hooks(hooks);
}
