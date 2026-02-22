import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, Invite } from '../../declarations';
import { Invites } from './invites.class';
import createModel from '../../models/invites.model';
import hooks from './invites.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    invites: Invites & ServiceAddons<Invite>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/invites', new Invites(options, app));

  const service = app.service('invites');
  service.hooks(hooks);
}
