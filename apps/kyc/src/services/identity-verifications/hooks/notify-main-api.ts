import { Hook, HookContext } from '@feathersjs/feathers';
import axios from 'axios';
import logger from '../../../logger';

/**
 * Fire-and-forget after.patch hook that notifies the main API via webhook
 * when a verification status changes.
 */
export const notifyMainApi = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const verification = context.result;
    if (!verification) return context;

    // Only notify on status changes
    if (!context.data?.status) return context;

    const mainApiUrl = context.app.get('mainApiUrl') || 'http://localhost:3030';
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.warn('[notify-main-api] WEBHOOK_SECRET not set, skipping notification');
      return context;
    }

    setImmediate(async () => {
      try {
        await axios.post(`${mainApiUrl}/webhooks/identity-verification`, {
          event: `verification.${verification.status}`,
          verification: {
            id: verification.id,
            userId: verification.userId,
            status: verification.status,
            rejectionReason: verification.rejectionReason,
            dniScanMatch: verification.dniScanMatch,
            faceMatch: verification.faceMatch,
            autoCheckCompletedAt: verification.autoCheckCompletedAt,
          },
        }, {
          headers: {
            'x-webhook-secret': webhookSecret,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        });
        logger.info('[notify-main-api] Notified main API: %s for verification %s',
          verification.status, verification.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[notify-main-api] Failed to notify main API: %s', message);
      }
    });

    return context;
  };
};
