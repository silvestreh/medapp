import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, OrganizationPatient } from '../../declarations';
import { OrganizationPatients } from './organization-patients.class';
import createModel from '../../models/organization-patients.model';
import hooks from './organization-patients.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'organization-patients': OrganizationPatients & ServiceAddons<OrganizationPatient>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/organization-patients', new OrganizationPatients(options, app));

  const service = app.service('organization-patients');
  service.hooks(hooks);
}
