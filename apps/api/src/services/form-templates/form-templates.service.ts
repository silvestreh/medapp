import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, FormTemplate } from '../../declarations';
import { FormTemplatesService } from './form-templates.class';
import createModel from '../../models/form-templates.model';
import hooks from './form-templates.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'form-templates': FormTemplatesService & ServiceAddons<FormTemplate>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/form-templates', new FormTemplatesService(options, app));

  const service = app.service('form-templates');
  service.hooks(hooks);
}
