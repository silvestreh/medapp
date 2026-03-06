import { ServiceAddons } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { LlmApiKeys } from './llm-api-keys.class';
import createModel from '../../models/llm-api-keys.model';
import hooks from './llm-api-keys.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'llm-api-keys': LlmApiKeys & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  createModel(app);
  app.use('/llm-api-keys', new LlmApiKeys(app));

  const service = app.service('llm-api-keys');
  service.hooks(hooks);
}
