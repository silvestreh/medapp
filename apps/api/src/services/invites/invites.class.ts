import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application, Invite } from '../../declarations';

export class Invites extends Service<Invite> {
  app: Application;

  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }
}
