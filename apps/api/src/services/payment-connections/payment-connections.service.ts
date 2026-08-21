import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { PaymentConnections } from './payment-connections.class';
import createConnectionsModel from '../../models/payment-connections.model';
import createOauthStatesModel from '../../models/payment-oauth-states.model';
import hooks from './payment-connections.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'payment-connections': PaymentConnections & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  // Registered for their side effect so sequelize.sync() creates the tables —
  // the custom class accesses them through sequelizeClient.models.
  createConnectionsModel(app);
  createOauthStatesModel(app);

  app.use('/payment-connections', new PaymentConnections(app));

  const service = app.service('payment-connections');

  service.hooks(hooks);
}
