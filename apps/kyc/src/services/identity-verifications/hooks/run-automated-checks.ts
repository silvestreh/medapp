import { Hook, HookContext } from '@feathersjs/feathers';
import axios from 'axios';
import { decryptFileFromDisk } from '../../../file-storage';
import { encryptJson } from '../../../encryption';
import { scanDniBarcode, validateDniAgainstPersonalData } from '../../../scan-dni-barcode';
import logger from '../../../logger';

/**
 * Fire-and-forget after.create hook that runs automated checks.
 * Decrypts ID front locally for barcode scan, then calls the face-compare
 * microservice for face verification (DNI image vs selfie video).
 * Auto-rejects on failures.
 */
export const runAutomatedChecks = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const verification = context.result;
    if (!verification) return context;

    const { id, idFrontUrl, selfieUrl, personalData } = verification;

    setImmediate(async () => {
      const app = context.app;
      const uploadsDir = app.get('uploads')?.dir || './uploads';
      const updates: Record<string, unknown> = {};

      logger.info('[auto-checks] Starting for verification %s', id);

      // Decrypt ID front locally for barcode scan
      let idFrontBuffer: Buffer;
      try {
        idFrontBuffer = decryptFileFromDisk(uploadsDir, idFrontUrl);
        logger.info('[auto-checks] Decrypted idFront: %d bytes', idFrontBuffer.length);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[auto-checks] Failed to decrypt idFront: %s', message);
        updates.autoCheckCompletedAt = new Date();
        updates.dniScanErrors = `Decrypt error: ${message}`;
        updates.faceMatchError = `Decrypt error: ${message}`;
        updates.status = 'rejected';
        updates.rejectionReason = `file_decrypt_failed:${message}`;
        try {
          await app.service('identity-verifications').patch(id, updates, { provider: undefined } as any);
        } catch (patchErr: unknown) {
          logger.error('[auto-checks] Failed to save error state: %s',
            patchErr instanceof Error ? patchErr.message : String(patchErr));
        }
        return;
      }

      // Step 1: Scan PDF417 barcode on ID front
      try {
        const dniScanData = await scanDniBarcode(idFrontBuffer);
        updates.dniScanData = encryptJson(dniScanData);

        const validationErrors = validateDniAgainstPersonalData(dniScanData, personalData || {});
        updates.dniScanMatch = validationErrors.length === 0;
        updates.dniScanErrors = validationErrors.length > 0 ? validationErrors.join('; ') : null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updates.dniScanData = null;
        updates.dniScanMatch = null;
        updates.dniScanErrors = message;
        logger.error('[auto-checks] PDF417 scan failed: %s', message);
      }

      // Step 2: Compare faces via face-compare microservice (DNI image vs selfie video)
      const faceCompareUrl = process.env.FACE_COMPARE_API_URL;
      const faceCompareApiKey = process.env.FACE_COMPARE_API_KEY;
      const kycBaseUrl = process.env.KYC_BASE_URL;

      if (!faceCompareUrl || !faceCompareApiKey || !kycBaseUrl) {
        logger.error('[auto-checks] Missing face-compare env vars (FACE_COMPARE_API_URL, FACE_COMPARE_API_KEY, KYC_BASE_URL)');
        updates.faceMatchConfidence = null;
        updates.faceMatch = null;
        updates.faceMatchError = 'Face compare service not configured';
      } else {
        try {
          const response = await axios.post(
            `${faceCompareUrl}/compare`,
            {
              id_url: `${kycBaseUrl}${idFrontUrl}`,
              video_url: `${kycBaseUrl}${selfieUrl}`,
            },
            {
              headers: { 'x-api-key': faceCompareApiKey },
              timeout: 120000,
            },
          );

          updates.faceMatch = response.data.verified;
          updates.faceMatchConfidence = `${response.data.similarity_percent}%`;
          updates.faceMatchError = null;
          logger.info(
            '[auto-checks] Face compare result: verified=%s, similarity=%s%%, frames=%d/%d',
            response.data.verified,
            response.data.similarity_percent,
            response.data.frames_matched,
            response.data.frames_analyzed,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          updates.faceMatchConfidence = null;
          updates.faceMatch = null;
          updates.faceMatchError = message;
          logger.error('[auto-checks] Face comparison failed: %s', message);
        }
      }

      // Auto-reject on failures
      updates.autoCheckCompletedAt = new Date();
      const rejectionReasons: string[] = [];

      if (updates.dniScanMatch === false && updates.dniScanErrors) {
        rejectionReasons.push(`dni_mismatch:${updates.dniScanErrors}`);
      } else if (updates.dniScanData === null && updates.dniScanErrors) {
        rejectionReasons.push(`dni_scan_failed:${updates.dniScanErrors}`);
      }

      if (updates.faceMatch === false) {
        rejectionReasons.push(`face_mismatch:${updates.faceMatchConfidence || 'unknown'}`);
      } else if (updates.faceMatch === null && updates.faceMatchError) {
        rejectionReasons.push(`face_match_failed:${updates.faceMatchError}`);
      }

      if (rejectionReasons.length > 0) {
        updates.status = 'rejected';
        updates.rejectionReason = rejectionReasons.join('\n');
      } else {
        updates.status = 'verified';
        updates.verifiedAt = new Date();
      }

      try {
        await app.service('identity-verifications').patch(id, updates, { provider: undefined } as any);
        if (rejectionReasons.length > 0) {
          logger.info('[auto-checks] Auto-rejected verification %s: %s', id, rejectionReasons.join('; '));
        } else {
          logger.info('[auto-checks] Completed for verification %s — all checks passed', id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[auto-checks] Failed to save results: %s', message);
      }
    });

    return context;
  };
};
