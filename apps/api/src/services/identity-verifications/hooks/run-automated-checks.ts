import { Hook, HookContext } from '@feathersjs/feathers';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { decryptFileFromDisk } from '../../../utils/decrypt-file';
import { decryptValue } from '../../../hooks/encryption';

const VERIFICATION_API_URL = process.env.VERIFICATION_API_URL || 'http://localhost:3032';

/**
 * Fire-and-forget after.create hook that runs automated checks on the uploaded documents.
 * Decrypts files locally, then sends them to the verification API for CPU-intensive
 * barcode scanning and face comparison.
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
      console.log(`[auto-checks] Starting for verification ${id} (user ${userId})`);

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

      // Decrypt files and send to verification API for processing
      try {
        console.log(`[auto-checks] Decrypting idFront: ${idFrontUrl}`);
        const idFrontBuffer = decryptFileFromDisk(uploadsDir, idFrontUrl);
        console.log(`[auto-checks] Decrypting selfie: ${selfieUrl}`);
        const selfieBuffer = decryptFileFromDisk(uploadsDir, selfieUrl);
        console.log(`[auto-checks] Decrypted files — idFront: ${idFrontBuffer.length} bytes, selfie: ${selfieBuffer.length} bytes`);

        // Create a JWT to authenticate with the verification API
        const authService = app.service('authentication') as any;
        const accessToken = await authService.createAccessToken({ sub: userId });

        const form = new FormData();
        form.append('idFront', idFrontBuffer, { filename: 'idFront.jpg', contentType: 'image/jpeg' });
        form.append('selfie', selfieBuffer, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
        form.append('personalData', JSON.stringify(personalData));

        console.log(`[auto-checks] Sending to verification API: ${VERIFICATION_API_URL}/run-checks`);

        const response = await axios.post(`${VERIFICATION_API_URL}/run-checks`, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 60000, // 60s timeout for ML processing
        });

        const result = response.data;
        console.log(`[auto-checks] Verification API response:`, JSON.stringify({
          dniScanMatch: result.dniScanMatch,
          dniScanErrors: result.dniScanErrors,
          faceMatch: result.faceMatch,
          faceSimilarityScore: result.faceSimilarityScore,
          faceMatchError: result.faceMatchError,
          selfieExifDate: result.selfieExifDate,
          selfieRecent: result.selfieRecent,
        }));
        updates.dniScanData = result.dniScanData;
        updates.dniScanMatch = result.dniScanMatch;
        updates.dniScanErrors = result.dniScanErrors;
        updates.faceSimilarityScore = result.faceSimilarityScore;
        updates.faceMatch = result.faceMatch;
        updates.faceMatchError = result.faceMatchError;
        updates.selfieExifDate = result.selfieExifDate;
        updates.selfieRecent = result.selfieRecent;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const axiosErr = err as any;
        console.error('[auto-checks] Verification API call failed:', message);
        if (axiosErr.response) {
          console.error('[auto-checks] Response status:', axiosErr.response.status);
          console.error('[auto-checks] Response data:', JSON.stringify(axiosErr.response.data));
        } else if (axiosErr.code) {
          console.error('[auto-checks] Error code:', axiosErr.code);
        }
        console.error('[auto-checks] Target URL:', `${VERIFICATION_API_URL}/run-checks`);
        updates.dniScanData = null;
        updates.dniScanMatch = null;
        updates.dniScanErrors = `Verification API error: ${message}`;
        updates.faceSimilarityScore = null;
        updates.faceMatch = null;
        updates.faceMatchError = `Verification API error: ${message}`;
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

      if (updates.selfieRecent === false) {
        rejectionReasons.push(`selfie_not_recent:${updates.selfieExifDate}`);
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
