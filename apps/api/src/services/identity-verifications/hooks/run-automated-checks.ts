import { Hook, HookContext } from '@feathersjs/feathers';
import path from 'path';
import { decryptFileFromDisk } from '../../../utils/decrypt-file';
import { scanDniBarcode, validateDniAgainstPersonalData } from '../../../utils/scan-dni-barcode';
import { compareFaces } from '../../../utils/compare-faces';
import { decryptValue } from '../../../hooks/encryption';
import { DniScanData } from '../../../declarations';

/**
 * Fire-and-forget after.create hook that runs automated checks on the uploaded documents:
 * 1. Scans PDF417 barcode on ID front → extracts personal data → validates against DB
 * 2. Compares faces between ID front photo and selfie
 *
 * Results are stored via internal patch (no provider → bypasses superadmin hooks).
 * If mismatches are found, the verification is auto-rejected with a descriptive reason.
 */
export const runAutomatedChecks = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const verification = context.result;
    if (!verification) return context;

    const { id, userId, idFrontUrl, selfieUrl } = verification;

    // Fire-and-forget: don't block the response
    setImmediate(async () => {
      const app = context.app;
      const uploadsDir = path.resolve(app.get('uploads')?.dir || './public/uploads');
      const updates: Record<string, unknown> = {};

      // Fetch the user's personal data for cross-validation
      let personalData: {
        firstName?: string | null;
        lastName?: string | null;
        documentValue?: string | null;
        birthDate?: string | null;
        gender?: string | null;
      } = {};

      try {
        const sequelize = app.get('sequelizeClient');
        const user = await sequelize.models.users.findByPk(userId, {
          include: [{
            model: sequelize.models.personal_data,
            attributes: ['firstName', 'lastName', 'documentType', 'documentValue', 'birthDate', 'gender'],
          }],
          raw: false,
          nest: true,
        });

        if (user) {
          const pd = (user as any).personal_data?.[0] || (user as any).personal_datum || null;
          if (pd) {
            personalData = {
              firstName: pd.firstName,
              lastName: pd.lastName,
              documentValue: pd.documentValue ? decryptValue(pd.documentValue) : null,
              birthDate: pd.birthDate ? decryptValue(pd.birthDate) : null,
              gender: pd.gender,
            };
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[auto-checks] Failed to fetch personal data:', message);
      }

      // Step 1: Scan PDF417 barcode on ID front
      let dniScanData: DniScanData | null = null;
      try {
        const idFrontBuffer = decryptFileFromDisk(uploadsDir, idFrontUrl);
        dniScanData = await scanDniBarcode(idFrontBuffer);
        updates.dniScanData = dniScanData;

        const validationErrors = validateDniAgainstPersonalData(dniScanData, personalData);
        updates.dniScanMatch = validationErrors.length === 0;
        updates.dniScanErrors = validationErrors.length > 0 ? validationErrors.join('; ') : null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updates.dniScanData = null;
        updates.dniScanMatch = null;
        updates.dniScanErrors = message;
        console.error('[auto-checks] PDF417 scan failed:', message);
      }

      // Step 2: Compare faces (ID front vs selfie)
      try {
        const idFrontBuffer = decryptFileFromDisk(uploadsDir, idFrontUrl);
        const selfieBuffer = decryptFileFromDisk(uploadsDir, selfieUrl);
        const result = await compareFaces(idFrontBuffer, selfieBuffer);
        updates.faceSimilarityScore = result.similarity;
        updates.faceMatch = result.match;
        updates.faceMatchError = null;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        updates.faceSimilarityScore = null;
        updates.faceMatch = null;
        updates.faceMatchError = message;
        console.error('[auto-checks] Face comparison failed:', message);
      }

      // Save results via internal patch (no provider → bypasses superadmin + sanitization hooks)
      updates.autoCheckCompletedAt = new Date();

      // Auto-reject if any data mismatches are found
      const rejectionReasons: string[] = [];

      if (updates.dniScanMatch === false && updates.dniScanErrors) {
        rejectionReasons.push(`dni_mismatch:${updates.dniScanErrors}`);
      }

      if (updates.faceMatch === false) {
        const score = updates.faceSimilarityScore;
        const pct = typeof score === 'number' ? `${(score * 100).toFixed(1)}%` : 'unknown';
        rejectionReasons.push(`face_mismatch:${pct}`);
      }

      if (rejectionReasons.length > 0) {
        updates.status = 'rejected';
        updates.rejectionReason = rejectionReasons.join('\n');
      }

      try {
        await app.service('identity-verifications').patch(id, updates, {
          provider: undefined,
        } as any);
        if (rejectionReasons.length > 0) {
          console.log(`[auto-checks] Auto-rejected verification ${id}: ${rejectionReasons.join('; ')}`);
        } else {
          console.log(`[auto-checks] Completed for verification ${id} — all checks passed`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[auto-checks] Failed to save results:', message);
      }
    });

    return context;
  };
};
