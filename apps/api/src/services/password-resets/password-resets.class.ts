import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application } from '../../declarations';

export interface PasswordReset {
  id: string;
  userId: string;
  token: string;
  status: 'pending' | 'used' | 'expired';
  expiresAt: Date;
}

export class PasswordResets extends Service<PasswordReset> {
  app: Application;

  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
    this.app = app;
  }
}
