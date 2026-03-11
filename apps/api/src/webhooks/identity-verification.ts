import { Application } from '../declarations';

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
          // SSSalud failed — don't set isVerified, but don't reject either.
          // Admin can review manually.
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
