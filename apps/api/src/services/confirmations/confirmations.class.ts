import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application } from '../../declarations';

export interface Confirmation {
  id: string;
  userId: string;
  type: 'password-reset' | 'email-verification';
  token: string;
  status: 'pending' | 'used' | 'expired';
  expiresAt: Date;
}

export class Confirmations extends Service<Confirmation> {
  app: Application;

  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }
}
