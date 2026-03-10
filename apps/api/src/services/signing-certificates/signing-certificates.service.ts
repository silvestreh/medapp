import { ServiceAddons } from '@feathersjs/feathers';
import multer from 'multer';
import type { Application, SigningCertificate } from '../../declarations';
import { SigningCertificates } from './signing-certificates.class';
import createModel from '../../models/signing-certificates.model';
import hooks from './signing-certificates.hooks';

declare module '../../declarations' {
  interface ServiceTypes {
    'signing-certificates': SigningCertificates & ServiceAddons<SigningCertificate>;
  }
}

const upload = multer({ storage: multer.memoryStorage() });

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  const conditionalMulter = (req: any, res: any, next: any) => {
    // Skip multer for JSON-based certificate generation requests
    if (req.body?.action === 'generate') {
      return next();
    }
    upload.single('certificate')(req, res, next);
  };

  const extractFileInfo = (req: any, _res: any, next: any) => {
    req.feathers.file = req.file;
    req.feathers.isClientEncrypted = req.body?.isClientEncrypted === 'true';
    next();
  };

  app.use(
    '/signing-certificates',
    conditionalMulter,
    extractFileInfo,
    new SigningCertificates(options, app) as any
  );

  const service = app.service('signing-certificates');
  service.hooks(hooks);
}
