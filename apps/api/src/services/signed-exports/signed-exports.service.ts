import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { SignedExports, SignedExportResult } from './signed-exports.class';
import hooks from './signed-exports.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'signed-exports': SignedExports & ServiceAddons<SignedExportResult>;
  }
}

export default function (app: Application): void {
  app.use('/signed-exports', new SignedExports(app));

  const service = app.service('signed-exports');
  service.hooks(hooks);
}
