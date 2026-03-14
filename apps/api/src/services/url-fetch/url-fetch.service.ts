import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { UrlFetch } from './url-fetch.class';
import hooks from './url-fetch.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'url-fetch': UrlFetch & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/url-fetch', new UrlFetch(app));

  const service = app.service('url-fetch');
  service.hooks(hooks);
}
