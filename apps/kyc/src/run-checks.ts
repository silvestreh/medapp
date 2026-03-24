import multer from 'multer';
import exifr from 'exifr';
import { Application } from './declarations';
import { scanDniBarcode, validateDniAgainstIdData, DniScanData } from './scan-dni-barcode';
import { compareFaces } from './compare-faces';
import logger from './logger';

/** Max age in minutes for a selfie to be considered "recent" */
const SELFIE_MAX_AGE_MINUTES = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

interface RunChecksResult {
  dniScanData: DniScanData | null;
  dniScanMatch: boolean | null;
  dniScanErrors: string | null;
  faceMatchConfidence: string | null;
  faceMatch: boolean | null;
  faceMatchError: string | null;
  selfieExifDate: string | null;
  selfieRecent: boolean | null;
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

      let idData: {
        firstName?: string | null;
        lastName?: string | null;
        dniNumber?: string | null;
        birthDate?: string | null;
        gender?: string | null;
      } = {};

      if (req.body.idData) {
        try {
          idData = JSON.parse(req.body.idData);
        } catch {
          return res.status(400).json({ message: 'idData must be valid JSON' });
        }
      }

      const idFrontBuffer = idFrontFile.buffer;
      const selfieBuffer = selfieFile.buffer;

      const result: RunChecksResult = {
        dniScanData: null,
        dniScanMatch: null,
        dniScanErrors: null,
        faceMatchConfidence: null,
        faceMatch: null,
        faceMatchError: null,
        selfieExifDate: null,
        selfieRecent: null,
      };

      // Step 1: Scan PDF417 barcode on ID front
      try {
        const dniScanData = await scanDniBarcode(idFrontBuffer);
        result.dniScanData = dniScanData;

        const validationErrors = validateDniAgainstIdData(dniScanData, idData);
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
        result.faceMatchConfidence = `${(faceResult.similarity * 100).toFixed(2)}%`;
        result.faceMatch = faceResult.match;
        result.faceMatchError = null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.faceMatchConfidence = null;
        result.faceMatch = null;
        result.faceMatchError = message;
        logger.error('[run-checks] Face comparison failed:', message);
      }

      // Step 3: Check selfie EXIF data for recency
      try {
        const exif = await exifr.parse(selfieBuffer, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
        const exifDate = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate || null;

        if (exifDate) {
          const photoTime = exifDate instanceof Date ? exifDate : new Date(exifDate);
          result.selfieExifDate = photoTime.toISOString();
          const ageMinutes = (Date.now() - photoTime.getTime()) / 60000;
          result.selfieRecent = ageMinutes <= SELFIE_MAX_AGE_MINUTES;
          logger.info('[run-checks] Selfie EXIF date: %s (age: %.1f min, recent: %s)',
            result.selfieExifDate, ageMinutes, result.selfieRecent);
        } else {
          // No EXIF date — camera captures from canvas (toBlob) strip EXIF.
          // This is expected for our flow, so we don't flag it as an error.
          result.selfieExifDate = null;
          result.selfieRecent = null;
          logger.info('[run-checks] No EXIF date found in selfie (expected for canvas captures)');
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('[run-checks] EXIF parse failed: %s', message);
        result.selfieExifDate = null;
        result.selfieRecent = null;
      }

      logger.info('[run-checks] Completed: dniMatch=%s, faceMatch=%s, selfieRecent=%s', result.dniScanMatch, result.faceMatch, result.selfieRecent);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[run-checks] Error:', message);
      res.status(500).json({ message: message || 'Check failed' });
    }
  });
}
