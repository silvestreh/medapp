// Initializes the `md-settings` service on path `/md-settings`
import type { Application, MdSettings as MdSettingsInterface, ServiceMethods } from '../../declarations';
import { MdSettings } from './md-settings.class';
import createModel from '../../models/md-settings.model';
import hooks from './md-settings.hooks';

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
    'md-settings': ServiceMethods<MdSettingsInterface>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate')
  };

  // Initialize our service with any options it requires
  app.use('/md-settings', new MdSettings(options, app));

  // Get our initialized service so that we can register hooks
  const service = app.service('md-settings');

  service.hooks(hooks);
}
