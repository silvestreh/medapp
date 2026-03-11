import { Hook, HookContext } from '@feathersjs/feathers';
import exifr from 'exifr';
import { decryptFileFromDisk } from '../../../file-storage';
import { encryptJson } from '../../../encryption';
import { scanDniBarcode, validateDniAgainstPersonalData } from '../../../scan-dni-barcode';
import { compareFaces } from '../../../compare-faces';
import logger from '../../../logger';

const SELFIE_MAX_AGE_MINUTES = 10;

/**
 * Fire-and-forget after.create hook that runs automated checks locally.
 * Decrypts files from local storage, runs barcode scan + face comparison + EXIF check.
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

      // Decrypt files locally
      let idFrontBuffer: Buffer;
      let selfieBuffer: Buffer;
      try {
        idFrontBuffer = decryptFileFromDisk(uploadsDir, idFrontUrl);
        selfieBuffer = decryptFileFromDisk(uploadsDir, selfieUrl);
        logger.info('[auto-checks] Decrypted files — idFront: %d bytes, selfie: %d bytes',
          idFrontBuffer.length, selfieBuffer.length);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[auto-checks] Failed to decrypt files: %s', message);
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

      // Step 2: Compare faces (ID front vs selfie)
      try {
        const faceResult = await compareFaces(idFrontBuffer, selfieBuffer);
        updates.faceMatchConfidence = `${(faceResult.similarity * 100).toFixed(2)}%`;
        updates.faceMatch = faceResult.match;
        updates.faceMatchError = null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updates.faceMatchConfidence = null;
        updates.faceMatch = null;
        updates.faceMatchError = message;
        logger.error('[auto-checks] Face comparison failed: %s', message);
      }

      // Step 3: Check selfie EXIF data for recency
      try {
        const exif = await exifr.parse(selfieBuffer, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
        const exifDate = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate || null;

        if (exifDate) {
          const photoTime = exifDate instanceof Date ? exifDate : new Date(exifDate);
          updates.selfieExifDate = photoTime.toISOString();
          const ageMinutes = (Date.now() - photoTime.getTime()) / 60000;
          updates.selfieRecent = ageMinutes <= SELFIE_MAX_AGE_MINUTES;
        } else {
          updates.selfieExifDate = null;
          updates.selfieRecent = null;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('[auto-checks] EXIF parse failed: %s', message);
        updates.selfieExifDate = null;
        updates.selfieRecent = null;
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

      if (updates.selfieRecent === false) {
        rejectionReasons.push(`selfie_not_recent:${updates.selfieExifDate}`);
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
