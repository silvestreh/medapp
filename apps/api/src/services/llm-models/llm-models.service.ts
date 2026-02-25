import { ServiceAddons } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { LlmModels, LlmModelsResult } from './llm-models.class';
import hooks from './llm-models.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'llm-models': LlmModels & ServiceAddons<LlmModelsResult>;
  }
}

export default function (app: Application): void {
  app.use('/llm-models', new LlmModels(app));

  const service = app.service('llm-models');
  service.hooks(hooks);
}
