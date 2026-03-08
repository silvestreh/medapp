import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, SharedEncounterAccess } from '../../declarations';
import { SharedEncounterAccessService } from './shared-encounter-access.class';
import createModel from '../../models/shared-encounter-access.model';
import hooks from './shared-encounter-access.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'shared-encounter-access': SharedEncounterAccessService & ServiceAddons<SharedEncounterAccess>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/shared-encounter-access', new SharedEncounterAccessService(options, app));

  const service = app.service('shared-encounter-access');
  service.hooks(hooks);
}
