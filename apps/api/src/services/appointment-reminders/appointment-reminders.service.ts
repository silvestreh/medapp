import type { Application, AppointmentReminder, ServiceMethods } from '../../declarations';
import { AppointmentReminders } from './appointment-reminders.class';
import createModel from '../../models/appointment-reminders.model';
import hooks from './appointment-reminders.hooks';
// Don't remove this comment. It's needed to format import lines nicely.

declare module '../../declarations' {
  interface ServiceTypes {
    'appointment-reminders': ServiceMethods<AppointmentReminder>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['remove']
  };

  app.use('/appointment-reminders', new AppointmentReminders(options, app));
  const service = app.service('appointment-reminders');
  service.hooks(hooks);
}
