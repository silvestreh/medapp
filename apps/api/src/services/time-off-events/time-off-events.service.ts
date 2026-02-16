// Initializes the `time-off-events` service on path `/time-off-events`
import type { Application, TimeOffEvent, ServiceMethods } from '../../declarations';
import { TimeOffEvents } from './time-off-events.class';
import createModel from '../../models/time-off-events.model';
import hooks from './time-off-events.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'time-off-events': ServiceMethods<TimeOffEvent>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app)
  };

  app.use('/time-off-events', new TimeOffEvents(options, app));

  const service = app.service('time-off-events');
  service.hooks(hooks);
}
