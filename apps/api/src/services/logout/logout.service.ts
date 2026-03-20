import type { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Logout } from './logout.class';
import hooks from './logout.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'logout': Logout & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/logout', new Logout(app));
  const service = app.service('logout');
  (service as any).hooks(hooks);
}
