import { ServiceAddons } from '@feathersjs/feathers';
import type { Application, IdentityVerification } from '../../declarations';
import { IdentityVerifications } from './identity-verifications.class';
import createModel from '../../models/identity-verifications.model';
import hooks from './identity-verifications.hooks';
import { validateIdPhoto } from './hooks/validate-id-photo';

declare module '../../declarations' {
  interface ServiceTypes {
    'identity-verifications': IdentityVerifications & ServiceAddons<IdentityVerification>;
  }
}

export default function (app: Application): void {
  const options = {
    Model: createModel(app),
    paginate: app.get('paginate'),
  };

  // Custom route: validate an uploaded ID photo for barcode + face
  // Must be registered before the Feathers service middleware
  (app as any).post('/identity-verifications/validate-photo', async (req: any, res: any) => {
    try {
      // Authenticate — reuse Feathers authentication
      const authResult = await (app as any).service('authentication').create(
        { strategy: 'jwt', accessToken: req.headers.authorization?.replace('Bearer ', '') },
        { provider: 'rest' }
      );
      if (!authResult?.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { fileUrl } = req.body;
      if (!fileUrl) {
        return res.status(400).json({ message: 'fileUrl is required' });
      }

      const result = await validateIdPhoto(app, fileUrl);
      res.json(result);
    } catch (error: any) {
      console.error('[validate-photo] Error:', error.message);
      res.status(500).json({ message: error.message || 'Validation failed' });
    }
  });

  app.use('/identity-verifications', new IdentityVerifications(options, app));

  const service = app.service('identity-verifications');
  service.hooks(hooks);
}
