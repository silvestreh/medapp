import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, FormTemplateVersion } from '../../declarations';
import { FormTemplateVersionsService } from './form-template-versions.class';
import createModel from '../../models/form-template-versions.model';
import hooks from './form-template-versions.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'form-template-versions': FormTemplateVersionsService & ServiceAddons<FormTemplateVersion>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/form-template-versions', new FormTemplateVersionsService(options, app));

  const service = app.service('form-template-versions');
  service.hooks(hooks);
}
