// Initializes the `study-results` service on path `/study-results`
import type { Application, StudyResult, ServiceMethods } from '../../declarations';
import { StudyResults } from './study-results.class';
import createModel from '../../models/study-results.model';
import hooks from './study-results.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'study-results': ServiceMethods<StudyResult>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/study-results', new StudyResults(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('study-results');

  service.hooks(hooks);
}
