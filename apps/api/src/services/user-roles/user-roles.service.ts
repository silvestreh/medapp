import { ServiceAddons } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import { UserRoles } from './user-roles.class';
import createModel from '../../models/user-roles.model';
import hooks from './user-roles.hooks';
// Don't remove this comment. It's needed to format import lines nicely.

declare module '../../declarations' {
  interface ServiceTypes {
    'user-roles': UserRoles & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/user-roles', new UserRoles(options, app));

  const service = app.service('user-roles');

  service.hooks(hooks);
}
