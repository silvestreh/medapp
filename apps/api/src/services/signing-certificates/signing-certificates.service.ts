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

  app.use(
    '/signing-certificates',
    // @ts-expect-error multer types conflict between express-serve-static-core v4 and v5
    upload.single('certificate'),
    (req: any, _res: any, next: any) => {
      req.feathers.file = req.file;
      req.feathers.isClientEncrypted = req.body?.isClientEncrypted === 'true';
      next();
    },
    new SigningCertificates(options, app)
  );

  const service = app.service('signing-certificates');
  service.hooks(hooks);
}
