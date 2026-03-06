import { Id, Params } from '@feathersjs/feathers';
import { MethodNotAllowed } from '@feathersjs/errors';
import type { Application } from '../../declarations';

export class FileUploads {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(_data: any, params?: Params): Promise<{ url: string }> {
    return { url: (params as any).uploadResult };
  }

  async find(): Promise<any> { throw new MethodNotAllowed(); }
  async get(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  async update(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  async patch(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  async remove(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
}
