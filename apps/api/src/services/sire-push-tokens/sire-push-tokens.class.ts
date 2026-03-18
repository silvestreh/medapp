import crypto from 'crypto';
import { BadRequest } from '@feathersjs/errors';
import type { Application } from '../../declarations';

export class SirePushTokens {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: { action: string; token?: string; deviceName?: string; platform?: string }, params?: any) {
    const { action } = data;

    switch (action) {
    case 'register':
      return this.register(data, params);
    case 'unregister':
      return this.unregister(data, params);
    default:
      throw new BadRequest('Unsupported action');
    }
  }

  private async register(data: { token?: string; deviceName?: string; platform?: string }, params: any) {
    const { token, deviceName, platform } = data;

    if (!token || typeof token !== 'string') {
      throw new BadRequest('Push token is required');
    }

    const patient = params?.patient;
    if (!patient) {
      throw new BadRequest('Patient context is required');
    }

    const sequelize = this.app.get('sequelizeClient');
    const PushTokenModel = sequelize.models.sire_push_tokens;

    const [record, created] = await PushTokenModel.findOrCreate({
      where: { token },
      defaults: {
        id: crypto.randomUUID(),
        patientId: patient.id,
        token,
        deviceName: deviceName || null,
        platform: platform || null,
      },
    });

    if (!created) {
      await record.update({
        patientId: patient.id,
        deviceName: deviceName || null,
        platform: platform || null,
      });
    }

    return { action: 'register', status: 'ok' };
  }

  private async unregister(data: { token?: string }, params: any) {
    const { token } = data;

    if (!token || typeof token !== 'string') {
      throw new BadRequest('Push token is required');
    }

    const patient = params?.patient;
    if (!patient) {
      throw new BadRequest('Patient context is required');
    }

    const sequelize = this.app.get('sequelizeClient');
    const PushTokenModel = sequelize.models.sire_push_tokens;

    await PushTokenModel.destroy({
      where: { token, patientId: patient.id },
    });

    return { action: 'unregister', status: 'ok' };
  }

}
