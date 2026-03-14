import type { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { WhatsAppInstances } from './whatsapp-instances.class';
import hooks from './whatsapp-instances.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'whatsapp-instances': WhatsAppInstances & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/whatsapp-instances', new WhatsAppInstances(app));

  const service = app.service('whatsapp-instances');
  service.hooks(hooks);
}
