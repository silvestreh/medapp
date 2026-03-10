import { ServiceAddons } from '@feathersjs/feathers';
import multer from 'multer';
import type { Application } from '../../declarations';
import { DocumentVerification, VerificationResult } from './document-verification.class';
import hooks from './document-verification.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'document-verification': DocumentVerification & ServiceAddons<VerificationResult>;
  }
}

const upload = multer({ storage: multer.memoryStorage() });

export default function (app: Application): void {
  const multerMiddleware = upload.single('pdf');

  app.use(
    '/document-verification',
    multerMiddleware as any,
    (req: any, _res: any, next: any) => {
      req.feathers.file = req.file;
      next();
    },
    new DocumentVerification(app) as any
  );

  const service = app.service('document-verification');
  service.hooks(hooks);
}
