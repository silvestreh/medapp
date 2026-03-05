import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Recetario, RecetarioResult } from './recetario.class';
import hooks from './recetario.hooks';
import { initRecetarioClient } from './recetario-client';

declare module '../../declarations' {
  interface ServiceTypes {
    'recetario': Recetario & ServiceAddons<RecetarioResult>;
  }
}

export default function (app: Application): void {
  initRecetarioClient(app);

  app.use('/recetario', new Recetario(app));

  const service = app.service('recetario');
  service.hooks(hooks);
}
