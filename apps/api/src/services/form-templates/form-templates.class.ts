import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, FormTemplate } from '../../declarations';

export class FormTemplatesService extends Service<FormTemplate> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
