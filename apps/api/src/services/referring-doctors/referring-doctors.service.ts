import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { ReferringDoctors, ReferringDoctor } from './referring-doctors.class';
import hooks from './referring-doctors.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'referring-doctors': ReferringDoctors & ServiceAddons<ReferringDoctor>;
  }
}

export default function (app: Application): void {
  app.use('/referring-doctors', new ReferringDoctors(app));

  const service = app.service('referring-doctors');
  service.hooks(hooks);
}
