import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, Organization } from '../../declarations';
import { Organizations } from './organizations.class';
import createModel from '../../models/organizations.model';
import hooks from './organizations.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'organizations': Organizations & ServiceAddons<Organization>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/organizations', new Organizations(options, app));

  const service = app.service('organizations');
  service.hooks(hooks);
}
