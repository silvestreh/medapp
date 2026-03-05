import type { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { WhatsApp } from './whatsapp.class';
import hooks from './whatsapp.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    whatsapp: WhatsApp & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/whatsapp', new WhatsApp(app));

  const service = app.service('whatsapp');
  service.hooks(hooks);
}
