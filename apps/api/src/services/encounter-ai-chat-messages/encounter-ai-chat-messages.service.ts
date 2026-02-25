import { ServiceAddons } from '@feathersjs/feathers';

import type { Application, ServiceMethods } from '../../declarations';
import { EncounterAiChatMessages, type EncounterAiChatMessageRecord } from './encounter-ai-chat-messages.class';
import createModel from '../../models/encounter-ai-chat-messages.model';
import hooks from './encounter-ai-chat-messages.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'encounter-ai-chat-messages': ServiceMethods<EncounterAiChatMessageRecord> & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  app.use('/encounter-ai-chat-messages', new EncounterAiChatMessages(options, app));

  const service = app.service('encounter-ai-chat-messages');
  service.hooks(hooks);
}

