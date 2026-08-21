import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { AttachmentLinks } from './attachment-links.class';
import hooks from './attachment-links.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'attachment-links': AttachmentLinks & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/attachment-links', new AttachmentLinks(app));
  app.service('attachment-links').hooks(hooks);
}
