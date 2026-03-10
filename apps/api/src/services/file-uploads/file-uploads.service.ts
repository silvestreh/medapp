import { ServiceAddons } from '@feathersjs/feathers';
import multer from 'multer';
import type { Application } from '../../declarations';
import { FileUploads } from './file-uploads.class';
import hooks from './file-uploads.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'file-uploads': FileUploads & ServiceAddons<any>;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export default function (app: Application): void {
  app.use(
    '/file-uploads',
    // @ts-expect-error multer types conflict between express-serve-static-core v4 and v5
    upload.single('file'),
    (req: any, _res: any, next: any) => {
      req.feathers.file = req.file;
      next();
    },
    new FileUploads(app)
  );

  const service = app.service('file-uploads');
  service.hooks(hooks);
}
