import { Application } from './declarations';
import logger from './logger';

interface ProgressPayload {
  step: string;
  current?: number | null;
  total?: number | null;
  position?: number | null;
  result?: {
    verified: boolean;
    distance: number;
    similarity_percent: number;
    frames_analyzed: number;
    frames_matched: number;
    per_frame: unknown[];
  } | null;
  error?: string | null;
}

/**
 * Receives progress callbacks from the face-compare service during async job processing.
 * Updates autoCheckProgress on the identity-verification record.
 * When step is "done" or "error", determines final verification status.
 */
export function setupAutoCheckProgress(app: Application): void {
  const expressApp = app as any;

  expressApp.post('/auto-check-progress/:id', async (req: any, res: any) => {
    // Authenticate with the same API key used for face-compare
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.FACE_COMPARE_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const verificationId = req.params.id;
    const { step, current, total, position, result, error } = req.body as ProgressPayload;

    logger.info('[auto-check-progress] %s: step=%s current=%s total=%s body=%j', verificationId, step, current, total, req.body);

    try {
      if (step === 'done' && result) {
        // Final result — determine verification status
        await handleDone(app, verificationId, result);
      } else if (step === 'error') {
        // Face comparison failed
        await handleError(app, verificationId, error || 'Unknown face compare error');
      } else {
        // Intermediate progress update
        await app.service('identity-verifications').patch(
          verificationId,
          {
            autoCheckProgress: { step, current: current ?? null, total: total ?? null, position: position ?? null },
          },
          { provider: undefined } as any,
        );
      }

      return res.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[auto-check-progress] Failed to update %s: %s', verificationId, message);
      return res.status(500).json({ message });
    }
  });
}

async function handleDone(
  app: Application,
  verificationId: string,
  result: NonNullable<ProgressPayload['result']>,
): Promise<void> {
  // Fetch current verification to get barcode scan results
  const verification = await app.service('identity-verifications').get(verificationId, {
    provider: undefined,
  } as any);

  const updates: Record<string, unknown> = {
    faceMatch: result.verified,
    faceMatchConfidence: `${result.similarity_percent}%`,
    faceMatchError: null,
    autoCheckCompletedAt: new Date(),
    autoCheckProgress: null,
  };

  // Auto-reject/verify logic (same as was in run-automated-checks)
  const rejectionReasons: string[] = [];

  if (verification.dniScanMatch === false && verification.dniScanErrors) {
    rejectionReasons.push(`dni_mismatch:${verification.dniScanErrors}`);
  } else if (verification.dniScanData === null && verification.dniScanErrors) {
    rejectionReasons.push(`dni_scan_failed:${verification.dniScanErrors}`);
  }

  if (!result.verified) {
    rejectionReasons.push(`face_mismatch:${result.similarity_percent}%`);
  }

  if (rejectionReasons.length > 0) {
    updates.status = 'rejected';
    updates.rejectionReason = rejectionReasons.join('\n');
  } else {
    updates.status = 'verified';
    updates.verifiedAt = new Date();
  }

  await app.service('identity-verifications').patch(
    verificationId,
    updates,
    { provider: undefined } as any,
  );

  if (rejectionReasons.length > 0) {
    logger.info('[auto-check-progress] Auto-rejected %s: %s', verificationId, rejectionReasons.join('; '));
  } else {
    logger.info('[auto-check-progress] Verified %s', verificationId);
  }
}

async function handleError(
  app: Application,
  verificationId: string,
  errorMessage: string,
): Promise<void> {
  // Fetch current verification to check barcode results
  const verification = await app.service('identity-verifications').get(verificationId, {
    provider: undefined,
  } as any);

  const updates: Record<string, unknown> = {
    faceMatch: null,
    faceMatchConfidence: null,
    faceMatchError: errorMessage,
    autoCheckCompletedAt: new Date(),
    autoCheckProgress: null,
  };

  // Evaluate rejection based on what we have
  const rejectionReasons: string[] = [];

  if (verification.dniScanMatch === false && verification.dniScanErrors) {
    rejectionReasons.push(`dni_mismatch:${verification.dniScanErrors}`);
  } else if (verification.dniScanData === null && verification.dniScanErrors) {
    rejectionReasons.push(`dni_scan_failed:${verification.dniScanErrors}`);
  }

  rejectionReasons.push(`face_match_failed:${errorMessage}`);

  updates.status = 'rejected';
  updates.rejectionReason = rejectionReasons.join('\n');

  await app.service('identity-verifications').patch(
    verificationId,
    updates,
    { provider: undefined } as any,
  );

  logger.error('[auto-check-progress] Auto-rejected %s (error): %s', verificationId, errorMessage);
}
