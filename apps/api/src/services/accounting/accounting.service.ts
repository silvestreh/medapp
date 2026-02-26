import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Accounting, AccountingResult } from './accounting.class';
import hooks from './accounting.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'accounting': Accounting & ServiceAddons<AccountingResult>;
  }
}

export default function (app: Application): void {
  app.use('/accounting', new Accounting(app));

  const service = app.service('accounting');
  service.hooks(hooks);
}
