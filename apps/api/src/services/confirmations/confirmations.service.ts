import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Confirmations, Confirmation } from './confirmations.class';
import createModel from '../../models/confirmations.model';
import hooks from './confirmations.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'confirmations': Confirmations & ServiceAddons<Confirmation>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/confirmations', new Confirmations(options, app));

  const service = app.service('confirmations');
  service.hooks(hooks);
}
