import { ServiceAddons } from '@feathersjs/feathers';

import type { Application } from '../../declarations';
import {
  EncounterAiChat,
  EncounterAiChatResult,
} from './encounter-ai-chat.class';
import hooks from './encounter-ai-chat.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'encounter-ai-chat': EncounterAiChat & ServiceAddons<EncounterAiChatResult>;
  }
}

export default function (app: Application): void {
  app.use('/encounter-ai-chat', new EncounterAiChat(app));

  const service = app.service('encounter-ai-chat');
  service.hooks(hooks);
}
