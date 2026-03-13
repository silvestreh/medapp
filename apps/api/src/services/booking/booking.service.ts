import { ServiceAddons } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import { Booking } from './booking.class';
import hooks from './booking.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    booking: Booking & ServiceAddons<any>;
  }
}

export default function (app: Application): void {
  app.use('/booking', new Booking(app));

  const service = app.service('booking');
  service.hooks(hooks);
}
