import { Id, Params } from '@feathersjs/feathers';
import { BadRequest, MethodNotAllowed, NotFound } from '@feathersjs/errors';
import path from 'path';
import fs from 'fs';
import type { Application } from '../../declarations';

export class FileUploads {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(_data: any, params?: Params): Promise<{ url: string }> {
    return { url: (params as any).uploadResult };
  }

  async remove(id: Id): Promise<{ deleted: boolean }> {
    const filename = String(id);
    if (!filename.endsWith('.enc')) {
      throw new BadRequest('Only encrypted files can be deleted');
    }
    // Prevent path traversal
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequest('Invalid filename');
    }

    const uploadsDir = this.app.get('uploads')?.dir || './public/uploads';
    const filePath = path.join(path.resolve(uploadsDir), filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFound('File not found');
    }

    fs.unlinkSync(filePath);
    return { deleted: true };
  }

  async find(): Promise<any> { throw new MethodNotAllowed(); }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async get(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async update(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async patch(_id: Id): Promise<any> { throw new MethodNotAllowed(); }
}
