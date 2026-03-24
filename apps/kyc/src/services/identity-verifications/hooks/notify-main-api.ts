import { Hook, HookContext } from '@feathersjs/feathers';
import axios from 'axios';
import crypto from 'crypto';
import logger from '../../../logger';

function hmacSignature(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Fire-and-forget after.patch hook that notifies the main API via webhook
 * and any per-session callback URL when a verification status changes.
 */
export const notifyMainApi = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const verification = context.result;
    if (!verification) return context;

    // Only notify on status changes
    if (!context.data?.status) return context;

    const mainApiUrl = context.app.get('mainApiUrl') || 'http://localhost:3030';
    const webhookSecret = process.env.WEBHOOK_SECRET;

    const payload = {
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
    };

    setImmediate(async () => {
      // 1. Notify main API (existing behavior)
      if (webhookSecret) {
        try {
          await axios.post(`${mainApiUrl}/webhooks/identity-verification`, payload, {
            headers: {
              'x-webhook-secret': webhookSecret,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });
          logger.info('[notify] Main API notified: %s for verification %s',
            verification.status, verification.id);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('[notify] Failed to notify main API: %s', message);
        }
      }

      // 2. Notify per-session callback URL (for third-party consumers)
      if (verification.sessionId) {
        try {
          const session = await context.app.service('verification-sessions').get(
            verification.sessionId,
            { provider: undefined } as any,
          );
          if (session?.callbackUrl) {
            const body = JSON.stringify(payload);
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session.callbackSecret) {
              headers['x-kyc-signature'] = hmacSignature(session.callbackSecret, body);
            }
            await axios.post(session.callbackUrl, body, { headers, timeout: 10000 });
            logger.info('[notify] Callback sent to %s for verification %s',
              session.callbackUrl, verification.id);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('[notify] Failed to send callback: %s', message);
        }
      }
    });

    return context;
  };
};
