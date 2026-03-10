import multer from 'multer';
import { Application } from './declarations';
import { scanDniBarcode, validateDniAgainstPersonalData, DniScanData } from './scan-dni-barcode';
import { compareFaces } from './compare-faces';
import logger from './logger';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface RunChecksResult {
  dniScanData: DniScanData | null;
  dniScanMatch: boolean | null;
  dniScanErrors: string | null;
  faceSimilarityScore: number | null;
  faceMatch: boolean | null;
  faceMatchError: string | null;
}

export function setupRunChecks(app: Application): void {
  const expressApp = app as any;

  const fileFields = upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]);

  expressApp.post('/run-checks', fileFields, async (req: any, res: any) => {
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

      const files = req.files as Record<string, Express.Multer.File[]>;
      const idFrontFile = files?.idFront?.[0];
      const selfieFile = files?.selfie?.[0];

      if (!idFrontFile || !selfieFile) {
        return res.status(400).json({ message: 'idFront and selfie files are required' });
      }

      let personalData: {
        firstName?: string | null;
        lastName?: string | null;
        documentValue?: string | null;
        birthDate?: string | null;
        gender?: string | null;
      } = {};

      if (req.body.personalData) {
        try {
          personalData = JSON.parse(req.body.personalData);
        } catch {
          return res.status(400).json({ message: 'personalData must be valid JSON' });
        }
      }

      const idFrontBuffer = idFrontFile.buffer;
      const selfieBuffer = selfieFile.buffer;

      const result: RunChecksResult = {
        dniScanData: null,
        dniScanMatch: null,
        dniScanErrors: null,
        faceSimilarityScore: null,
        faceMatch: null,
        faceMatchError: null,
      };

      // Step 1: Scan PDF417 barcode on ID front
      try {
        const dniScanData = await scanDniBarcode(idFrontBuffer);
        result.dniScanData = dniScanData;

        const validationErrors = validateDniAgainstPersonalData(dniScanData, personalData);
        result.dniScanMatch = validationErrors.length === 0;
        result.dniScanErrors = validationErrors.length > 0 ? validationErrors.join('; ') : null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.dniScanData = null;
        result.dniScanMatch = null;
        result.dniScanErrors = message;
        logger.error('[run-checks] PDF417 scan failed:', message);
      }

      // Step 2: Compare faces (ID front vs selfie)
      try {
        const faceResult = await compareFaces(idFrontBuffer, selfieBuffer);
        result.faceSimilarityScore = faceResult.similarity;
        result.faceMatch = faceResult.match;
        result.faceMatchError = null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.faceSimilarityScore = null;
        result.faceMatch = null;
        result.faceMatchError = message;
        logger.error('[run-checks] Face comparison failed:', message);
      }

      logger.info('[run-checks] Completed: dniMatch=%s, faceMatch=%s', result.dniScanMatch, result.faceMatch);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[run-checks] Error:', message);
      res.status(500).json({ message: message || 'Check failed' });
    }
  });
}
