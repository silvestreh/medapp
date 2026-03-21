import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, PracticeCode } from '../../declarations';
import { PracticeCodesService } from './practice-codes.class';
import createModel from '../../models/practice-codes.model';
import hooks from './practice-codes.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'practice-codes': PracticeCodesService & ServiceAddons<PracticeCode>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['remove'],
  };

  app.use('/practice-codes', new PracticeCodesService(options, app));

  const service = app.service('practice-codes');
  service.hooks(hooks);
}
