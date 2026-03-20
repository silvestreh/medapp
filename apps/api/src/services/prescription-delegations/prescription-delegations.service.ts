import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, PrescriptionDelegation } from '../../declarations';
import { PrescriptionDelegationsService } from './prescription-delegations.class';
import createModel from '../../models/prescription-delegations.model';
import hooks from './prescription-delegations.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'prescription-delegations': PrescriptionDelegationsService & ServiceAddons<PrescriptionDelegation>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  app.use('/prescription-delegations', new PrescriptionDelegationsService(options, app));

  const service = app.service('prescription-delegations');
  service.hooks(hooks);
}
