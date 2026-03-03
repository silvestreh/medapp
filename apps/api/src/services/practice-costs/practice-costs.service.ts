import type { Application, PracticeCost, ServiceMethods } from '../../declarations';
import { PracticeCosts } from './practice-costs.class';
import createModel from '../../models/practice-costs.model';
import hooks from './practice-costs.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'practice-costs': ServiceMethods<PracticeCost>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
    multi: ['patch', 'remove'],
  };

  app.use('/practice-costs', new PracticeCosts(options, app));

  const service = app.service('practice-costs');
  service.hooks(hooks);
}
