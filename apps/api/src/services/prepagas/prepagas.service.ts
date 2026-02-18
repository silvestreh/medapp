import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, Prepaga } from '../../declarations';
import { Prepagas } from './prepagas.class';
import createModel from '../../models/prepagas.model';
import hooks from './prepagas.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    prepagas: Prepagas & ServiceAddons<Prepaga>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['create']
  };

  app.use('/prepagas', new Prepagas(options, app));

  const service = app.service('prepagas');
  service.hooks(hooks);
}
