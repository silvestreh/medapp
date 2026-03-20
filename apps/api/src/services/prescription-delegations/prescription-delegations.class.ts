import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, PrescriptionDelegation } from '../../declarations';

export class PrescriptionDelegationsService extends Service<PrescriptionDelegation> {
  //eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
