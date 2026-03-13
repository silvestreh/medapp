import type { Application } from '../../declarations';

export class Booking {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: any) {
    const patientId = params.patient?.id;
    console.log('\n\n\n\n');
    console.log('find on booking service', patientId);
    console.log('params', params);
    console.log('\n\n\n\n');
    return { patientId, data: [] };
  }

  async create(data: any, params: any) {
    const patientId = params.patient?.id;
    return { patientId, ...data };
  }
}
