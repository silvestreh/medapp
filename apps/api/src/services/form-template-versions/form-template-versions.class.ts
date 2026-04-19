import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, FormTemplateVersion } from '../../declarations';

export class FormTemplateVersionsService extends Service<FormTemplateVersion> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
