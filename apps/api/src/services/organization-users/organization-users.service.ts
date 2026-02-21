import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, OrganizationUser } from '../../declarations';
import { OrganizationUsers } from './organization-users.class';
import createModel from '../../models/organization-users.model';
import hooks from './organization-users.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'organization-users': OrganizationUsers & ServiceAddons<OrganizationUser>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/organization-users', new OrganizationUsers(options, app));

  const service = app.service('organization-users');
  service.hooks(hooks);
}
