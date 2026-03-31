import { Hook, HookContext } from '@feathersjs/feathers';
import axios from 'axios';
import { decryptFileFromDisk } from '../../../file-storage';
import { encryptJson } from '../../../encryption';
import { scanDniBarcode, validateDniAgainstIdData } from '../../../scan-dni-barcode';
import { scanPassportMrz, validateMrzAgainstIdData } from '../../../scan-passport-mrz';
import logger from '../../../logger';

/**
 * Fire-and-forget after.create hook that runs automated checks.
 * Decrypts ID front locally for barcode scan, then submits an async job
 * to the face-compare microservice. Progress updates arrive via callbacks
 * to /auto-check-progress/:id.
 */
export const runAutomatedChecks = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const verification = context.result;
    if (!verification) return context;

    const { id, idFrontUrl, selfieUrl, idData, documentType } = verification;

    setImmediate(async () => {
      const app = context.app;
      const uploadsDir = app.get('uploads')?.dir || './uploads';
      const patchProgress = async (progress: Record<string, unknown>) => {
        try {
          await app.service('identity-verifications').patch(id, progress, { provider: undefined } as any);
        } catch (err: unknown) {
          logger.error('[auto-checks] Failed to patch progress: %s',
            err instanceof Error ? err.message : String(err));
        }
      };

      logger.info('[auto-checks] Starting for verification %s', id);

      const isPassport = documentType === 'passport';
      const scanStepName = isPassport ? 'scanning_mrz' : 'scanning_barcode';

      // Update progress: scanning document
      await patchProgress({ autoCheckProgress: { step: scanStepName, current: null, total: null, position: null } });

      // Decrypt ID front locally for scanning
      let idFrontBuffer: Buffer;
      try {
        idFrontBuffer = decryptFileFromDisk(uploadsDir, idFrontUrl);
        logger.info('[auto-checks] Decrypted idFront: %d bytes', idFrontBuffer.length);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[auto-checks] Failed to decrypt idFront: %s', message);
        await patchProgress({
          autoCheckCompletedAt: new Date(),
          autoCheckProgress: null,
          dniScanErrors: `Decrypt error: ${message}`,
          faceMatchError: `Decrypt error: ${message}`,
          status: 'rejected',
          rejectionReason: `file_decrypt_failed:${message}`,
        });
        return;
      }

      // Step 1: Scan document (barcode for DNI, MRZ for passport)
      const updates: Record<string, unknown> = {};
      if (isPassport) {
        try {
          const mrzScanData = await scanPassportMrz(idFrontBuffer);
          updates.dniScanData = encryptJson(mrzScanData);

          const validationErrors = validateMrzAgainstIdData(mrzScanData, idData || {});
          updates.dniScanMatch = validationErrors.length === 0;
          updates.dniScanErrors = validationErrors.length > 0 ? validationErrors.join('; ') : null;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          updates.dniScanData = null;
          updates.dniScanMatch = null;
          updates.dniScanErrors = message;
          logger.error('[auto-checks] MRZ scan failed: %s', message);
        }
      } else {
        try {
          const dniScanData = await scanDniBarcode(idFrontBuffer);
          updates.dniScanData = encryptJson(dniScanData);

          const validationErrors = validateDniAgainstIdData(dniScanData, idData || {});
          updates.dniScanMatch = validationErrors.length === 0;
          updates.dniScanErrors = validationErrors.length > 0 ? validationErrors.join('; ') : null;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          updates.dniScanData = null;
          updates.dniScanMatch = null;
          updates.dniScanErrors = message;
          logger.error('[auto-checks] PDF417 scan failed: %s', message);
        }
      }

      // Early rejection: skip face comparison if document data doesn't match
      if (updates.dniScanMatch === false) {
        const mismatchType = isPassport ? 'mrz_mismatch' : 'dni_mismatch';
        logger.info('[auto-checks] %s — rejecting without face comparison', mismatchType);
        await patchProgress({
          ...updates,
          autoCheckCompletedAt: new Date(),
          autoCheckProgress: null,
          faceMatch: null,
          faceMatchConfidence: null,
          faceMatchError: `Skipped: ${isPassport ? 'MRZ' : 'DNI'} data mismatch`,
          status: 'rejected',
          rejectionReason: `${mismatchType}:${updates.dniScanErrors}`,
        });
        return;
      }

      if (updates.dniScanData === null && updates.dniScanErrors) {
        // Scan failed on the server — this can happen with compressed images.
        // For DNI, the client already validated the barcode. For passport, continue to face comparison.
        logger.warn('[auto-checks] Server-side %s scan failed (continuing): %s',
          isPassport ? 'MRZ' : 'barcode', updates.dniScanErrors);
      }

      // Save barcode results and update progress
      await patchProgress({
        ...updates,
        autoCheckProgress: { step: 'submitting_face_compare', current: null, total: null, position: null },
      });

      // Step 2: Submit async face comparison job
      const faceCompareUrl = process.env.FACE_COMPARE_API_URL;
      const faceCompareApiKey = process.env.FACE_COMPARE_API_KEY;
      const kycBaseUrl = process.env.KYC_BASE_URL;

      if (!faceCompareUrl || !faceCompareApiKey || !kycBaseUrl) {
        logger.error('[auto-checks] Missing face-compare env vars (FACE_COMPARE_API_URL, FACE_COMPARE_API_KEY, KYC_BASE_URL)');
        await patchProgress({
          autoCheckCompletedAt: new Date(),
          autoCheckProgress: null,
          faceMatchConfidence: null,
          faceMatch: null,
          faceMatchError: 'Face compare service not configured',
          status: 'rejected',
          rejectionReason: 'face_match_failed:Face compare service not configured',
        });
        return;
      }

      const payload = {
        id_url: `${kycBaseUrl}${idFrontUrl}`,
        video_url: `${kycBaseUrl}${selfieUrl}`,
        progress_url: `${kycBaseUrl}/auto-check-progress/${id}`,
        verification_id: id,
        callback_key: faceCompareApiKey,
      };
      logger.info('[auto-checks] Submitting to %s/compare-async with id_url=%s video_url=%s progress_url=%s',
        faceCompareUrl, payload.id_url, payload.video_url, payload.progress_url);

      try {
        const response = await axios.post(
          `${faceCompareUrl}/compare-async`,
          payload,
          {
            timeout: 10000, // Just submitting — should be fast
          },
        );

        logger.info(
          '[auto-checks] Face compare job submitted: job_id=%s, queue_position=%d, response=%j',
          response.data.job_id,
          response.data.queue_position,
          response.data,
        );
        // Progress updates and final result will arrive via callbacks to /auto-check-progress/:id
      } catch (err: unknown) {
        const axiosErr = err as any;
        const message = axiosErr instanceof Error ? axiosErr.message : String(axiosErr);
        logger.error('[auto-checks] Failed to submit face compare job: %s | status=%s body=%j',
          message, axiosErr.response?.status, axiosErr.response?.data);
        await patchProgress({
          autoCheckCompletedAt: new Date(),
          autoCheckProgress: null,
          faceMatchConfidence: null,
          faceMatch: null,
          faceMatchError: message,
          status: 'rejected',
          rejectionReason: `face_match_failed:${message}`,
        });
      }
    });

    return context;
  };
};
