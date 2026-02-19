import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Profile } from './profile.class';
import hooks from './profile.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    profile: Profile & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/profile', new Profile(app));

  const service = app.service('profile');
  service.hooks(hooks);
}
