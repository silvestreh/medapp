import { ServiceAddons } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import { LlmProviderKeys } from './llm-provider-keys.class';
import hooks from './llm-provider-keys.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'llm-provider-keys': LlmProviderKeys & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/llm-provider-keys', new LlmProviderKeys(app));

  const service = app.service('llm-provider-keys');
  service.hooks(hooks);
}
