import type { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Mailer } from './mailer.class';
import hooks from './mailer.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    mailer: Mailer & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/mailer', new Mailer(app));

  const service = app.service('mailer');
  service.hooks(hooks);
}
