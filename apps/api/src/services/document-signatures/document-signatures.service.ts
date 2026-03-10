import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, DocumentSignature } from '../../declarations';
import { DocumentSignatures } from './document-signatures.class';
import createModel from '../../models/document-signatures.model';
import hooks from './document-signatures.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'document-signatures': DocumentSignatures & ServiceAddons<DocumentSignature>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/document-signatures', new DocumentSignatures(options, app));

  const service = app.service('document-signatures');
  service.hooks(hooks);
}
