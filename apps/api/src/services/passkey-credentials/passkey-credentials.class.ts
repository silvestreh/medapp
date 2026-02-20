import { Service, SequelizeServiceOptions } from 'feathers-sequelize';
import type { Application } from '../../declarations';

export interface PasskeyCredential {
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
  deviceName: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export class PasskeyCredentials extends Service<PasskeyCredential> {
  constructor(options: Partial<SequelizeServiceOptions>, app: Application) {
    super(options);
  }
}
