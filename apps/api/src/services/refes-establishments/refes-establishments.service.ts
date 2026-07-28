// Initializes the `refes-establishments` service on path `/refes-establishments`
import type { Application, ServiceMethods, RefesEstablishment } from '../../declarations';
import { RefesEstablishmentsService } from './refes-establishments.class';
import createModel from '../../models/refes-establishments.model';
import hooks from './refes-establishments.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'refes-establishments': ServiceMethods<RefesEstablishment> &
      Pick<RefesEstablishmentsService, 'bulkUpsert'>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['create', 'patch', 'remove']
  };

  // Initialize our service with any options it requires
  app.use('/refes-establishments', new RefesEstablishmentsService(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('refes-establishments');

  service.hooks(hooks);
}
