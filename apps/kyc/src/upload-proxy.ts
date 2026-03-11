import multer from 'multer';
import { Application } from './declarations';
import logger from './logger';
import { scanDniBarcode } from './scan-dni-barcode';
import { encryptToDisk } from './file-storage';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

/**
 * Authenticates the upload request via session token or JWT.
 * Returns true if authenticated, false otherwise.
 */
async function authenticateUpload(app: Application, req: any, res: any): Promise<boolean> {
  // Option 1: Session token (mobile flow)
  const sessionToken = req.headers['x-session-token'];
  if (sessionToken) {
    await app.get('sequelizeSync');
    const sequelize = app.get('sequelizeClient');
    const session = await sequelize.models.verification_sessions.findOne({
      where: { token: sessionToken },
      raw: true,
    });

    if (!session) {
      res.status(403).json({ message: 'Invalid session token' });
      return false;
    }

    if (new Date(session.expiresAt) < new Date()) {
      res.status(400).json({ message: 'Session has expired' });
      return false;
    }

    return true;
  }

  // Option 2: JWT (desktop flow)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const authService = app.service('authentication') as any;
      const accessToken = authHeader.replace('Bearer ', '');
      const result = await authService.create(
        { strategy: 'jwt', accessToken },
        { provider: 'rest' }
      );
      if (result?.user) return true;
    } catch {
      // Fall through to 401
    }
  }

  res.status(401).json({ message: 'Authentication required' });
  return false;
}

export function setupUploadProxy(app: Application): void {
  const expressApp = app as any;

  expressApp.post('/upload', upload.single('file'), async (req: any, res: any) => {
    try {
      const authenticated = await authenticateUpload(app, req, res);
      if (!authenticated) return;

      if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      // Validate barcode on ID front before accepting the upload
      if (req.file.originalname === 'idFront.jpg') {
        try {
          await scanDniBarcode(req.file.buffer);
          logger.info('[upload] ID front barcode validation passed');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn('[upload] ID front barcode validation failed: %s', message);
          return res.status(422).json({
            message: 'No se detectó el código de barras del DNI. Asegurate de que la foto muestre el frente completo del documento.',
          });
        }
      }

      const ext = MIME_TO_EXT[req.file.mimetype] || '.bin';
      const uploadsDir = app.get('uploads')?.dir || './uploads';
      const url = encryptToDisk(req.file.buffer, ext, uploadsDir);

      logger.info('[upload] File stored locally: %s', url);
      return res.json({ url });
    } catch (error: any) {
      logger.error('[upload] Error: %s', error.message);
      return res.status(500).json({ message: error.message || 'Upload failed' });
    }
  });
}
