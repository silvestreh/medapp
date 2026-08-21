import crypto from 'crypto';
import type { Application } from '../declarations';
import type { RawWebhookRequest } from '../services/payments/domain';
import { getProvider, hasProvider } from '../services/payments/provider-registry';
import { processPaymentEvent } from '../services/payments/process-payment-event';
import Sentry from '../sentry';
import logger from '../logger';

// Thin HTTP layer for payment webhooks: verify signature → durable dedupe →
// respond 200 fast → process asynchronously and defensively. All provider
// vocabulary lives in the adapter; all business rules live in
// process-payment-event.ts.
export default function paymentWebhookHandler(app: Application, providerId: string) {
  return async (req: any, res: any): Promise<void> => {
    try {
      if (!hasProvider(providerId)) {
        return res.status(503).json({ ok: false, error: 'Provider not configured' });
      }

      const provider = getProvider(providerId);
      const raw: RawWebhookRequest = {
        headers: req.headers ?? {},
        query: req.query ?? {},
        rawBody: req.rawBody ?? '',
        body: req.body,
      };

      const verification = provider.verifyWebhook(raw);

      if (!verification.valid) {
        logger.warn('Payment webhook rejected: %s', verification.reason);
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const event = provider.parseWebhook(raw);
      const eventsModel = app.get('sequelizeClient').models.payment_webhook_events;
      const providerEventId = event.providerEventId || `req:${req.headers?.['x-request-id'] ?? crypto.randomUUID()}`;

      let eventRow: any;
      try {
        eventRow = await eventsModel.create({
          provider: providerId,
          providerEventId,
          topic: event.topic,
        });
      } catch (error: any) {
        if (error?.name === 'SequelizeUniqueConstraintError') {
          return res.json({ ok: true, duplicate: true });
        }
        throw error;
      }

      // Respond before processing so provider retries aren't tied to our work.
      res.json({ ok: true });

      processPaymentEvent(app, providerId, event)
        .then((result) => eventsModel.update(
          {
            processedAt: new Date(),
            outcome: result.outcome,
            appointmentPaymentId: result.appointmentPaymentId ?? null,
          },
          { where: { id: eventRow.id } }
        ))
        .catch((error: any) => {
          logger.error('Payment webhook processing failed: %s', error?.message);
          Sentry.captureException(error);
          return eventsModel.update(
            { processedAt: new Date(), outcome: 'error' },
            { where: { id: eventRow.id } }
          ).catch(() => undefined);
        });
    } catch (error: any) {
      logger.error('Payment webhook error: %s', error?.message);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Internal error' });
      }
    }
  };
}
