import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, DocumentSignature } from '../../declarations';

export class DocumentSignatures extends Service<DocumentSignature> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
