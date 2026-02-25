import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Stats, StatsResult } from './stats.class';
import hooks from './stats.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'stats': Stats & ServiceAddons<StatsResult>;
  }
}

export default function (app: Application): void {
  app.use('/stats', new Stats(app));

  const service = app.service('stats');
  service.hooks(hooks);
}
