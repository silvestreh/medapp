// Initializes the `studies` service on path `/studies`
import type { Application, Study, ServiceMethods } from '../../declarations';
import { Studies } from './studies.class';
import createModel from '../../models/studies.model';
import hooks from './studies.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'studies': ServiceMethods<Study>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['patch']
  };

  // Initialize our service with any options it requires
  app.use('/studies', new Studies(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('studies');

  service.hooks(hooks);
}
