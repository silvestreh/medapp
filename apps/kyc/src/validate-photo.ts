import multer from 'multer';
import { Application } from './declarations';
import { detectFace } from './detect-face';
import logger from './logger';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface ValidationResult {
  hasBarcode: boolean;
  hasFace: boolean;
}

export function setupValidatePhoto(app: Application): void {
  const expressApp = app as any;

  expressApp.post('/validate-photo', upload.single('file'), async (req: any, res: any) => {
    try {
      // Authenticate using the shared JWT secret
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const authService = app.service('authentication') as any;
      const accessToken = authHeader.replace('Bearer ', '');
      const authResult = await authService.create(
        { strategy: 'jwt', accessToken },
        { provider: 'rest' }
      );
      if (!authResult?.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'file is required' });
      }

      const buffer = req.file.buffer as Buffer;
      const result: ValidationResult = {
        hasBarcode: false,
        hasFace: false,
      };

      // Check for PDF417 barcode
      try {
        const { createCanvas, loadImage } = require('canvas');
        const { readBarcodesFromImageData } = require('zxing-wasm/reader');

        const image = await loadImage(buffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const results = await readBarcodesFromImageData(
          imageData as unknown as ImageData,
          { formats: ['PDF417'], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 1 }
        );

        result.hasBarcode = results.length > 0;
      } catch (err) {
        logger.error('[validate-photo] Barcode detection error:', err);
        result.hasBarcode = false;
      }

      // Check for face
      try {
        result.hasFace = await detectFace(buffer);
      } catch (err) {
        logger.error('[validate-photo] Face detection error:', err);
        result.hasFace = false;
      }

      res.json(result);
    } catch (error: any) {
      logger.error('[validate-photo] Error:', error.message);
      res.status(500).json({ message: error.message || 'Validation failed' });
    }
  });
}
