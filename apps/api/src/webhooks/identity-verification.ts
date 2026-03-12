import axios from 'axios';
import { Application } from '../declarations';

const VERIFICATION_API_URL = process.env.VERIFICATION_API_URL || 'http://localhost:3032';

interface VerificationWebhookPayload {
  event: string;
  verification: {
    id: string;
    userId: string;
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason: string | null;
    dniScanMatch: boolean | null;
    faceMatch: boolean | null;
    autoCheckCompletedAt: string | null;
  };
}

export function setupIdentityVerificationWebhook(app: Application): void {
  const expressApp = app as any;

  expressApp.post('/webhooks/identity-verification', async (req: any, res: any) => {
    try {
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('[webhook] WEBHOOK_SECRET not configured');
        return res.status(500).json({ message: 'Webhook not configured' });
      }

      const receivedSecret = req.headers['x-webhook-secret'];
      if (receivedSecret !== webhookSecret) {
        return res.status(401).json({ message: 'Invalid webhook secret' });
      }

      const payload = req.body as VerificationWebhookPayload;
      const { event, verification } = payload;

      if (!event || !verification) {
        return res.status(400).json({ message: 'Invalid payload' });
      }

      console.log('[webhook] Received: %s for verification %s (user %s)',
        event, verification.id, verification.userId);

      const sequelize = app.get('sequelizeClient');

      if (event === 'verification.rejected') {
        // Set md_settings.isVerified = false
        const mdSettings = await sequelize.models.md_settings.findOne({
          where: { userId: verification.userId },
          raw: true,
        });

        if (mdSettings) {
          await app.service('md-settings').patch(mdSettings.id, {
            isVerified: false,
          });
          console.log('[webhook] Set md_settings.isVerified=false for user %s', verification.userId);
        }
      }

      if (event === 'verification.verified') {
        // Auto-checks passed — run SSSalud validation
        try {
          const practitionerVerification = app.service('practitioner-verification') as any;
          await practitionerVerification.verifyByUserId(verification.userId);
          console.log('[webhook] SSSalud verification passed for user %s', verification.userId);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[webhook] SSSalud verification failed for user %s: %s', verification.userId, message);
          // Revert: reject the identity verification since license is invalid
          // Call KYC directly (the proxy service requires a JWT we don't have here)
          try {
            await axios.patch(
              `${VERIFICATION_API_URL}/identity-verifications/${verification.id}`,
              { status: 'rejected', rejectionReason: `license_invalid:${message}` },
              { headers: { 'x-webhook-secret': webhookSecret } }
            );
            console.log('[webhook] Reverted verification %s to rejected (SSSalud failed)', verification.id);
          } catch (revertErr: unknown) {
            const revertMessage = revertErr instanceof Error ? revertErr.message : String(revertErr);
            console.error('[webhook] Failed to revert verification %s: %s', verification.id, revertMessage);
          }
        }
      }

      // Send notification email for new pending verifications
      if (event === 'verification.pending') {
        try {
          const fullUser = await app.service('users').get(verification.userId, { provider: undefined } as any) as any;
          const personalData = fullUser.personalData || {};
          const fullName = [personalData.firstName, personalData.lastName].filter(Boolean).join(' ') || fullUser.username;

          await app.service('mailer').create({
            template: 'identity-verification-pending',
            to: 'admin@athel.as',
            subject: `New identity verification: ${fullName}`,
            data: {
              userName: fullName,
              userId: verification.userId,
            },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[webhook] Failed to send notification email:', message);
        }
      }

      res.json({ ok: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[webhook] Error:', message);
      res.status(500).json({ message: 'Internal error' });
    }
  });
}
