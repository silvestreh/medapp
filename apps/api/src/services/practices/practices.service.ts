import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, Practice } from '../../declarations';
import { PracticesService } from './practices.class';
import createModel from '../../models/practices.model';
import hooks from './practices.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'practices': PracticesService & ServiceAddons<Practice>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/practices', new PracticesService(options, app));

  const service = app.service('practices');
  service.hooks(hooks);
}
