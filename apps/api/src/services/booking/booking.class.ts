import type { Application } from '../../declarations';

export class Booking {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: any) {
    const patientId = params.patient?.id;
    return { patientId, data: [] };
  }

  async create(data: any, params: any) {
    const patientId = params.patient?.id;
    return { patientId, ...data };
  }
}
