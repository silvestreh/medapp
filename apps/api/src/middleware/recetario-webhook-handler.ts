import { createHmac } from 'crypto';
import type { Application } from '../declarations';

const processedRequestIds = new Set<string>();
const MAX_PROCESSED_IDS = 10000;

function verifySignature(req: any, webhookSecret: string): boolean {
  if (!webhookSecret) return false;

  const timestamp = req.headers['x-timestamp'] as string;
  const requestId = req.headers['x-request-id'] as string;
  const signature = req.headers['x-signature'] as string;

  if (!timestamp || !requestId || !signature) return false;

  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const payload = `${timestamp}.${requestId}.${rawBody}`;
  const expected = createHmac('sha256', webhookSecret).update(payload).digest('hex');

  return signature === expected;
}

export default function recetarioWebhookHandler(app: Application) {
  const recetarioConfig = (app.get as any)('recetario') || {};
  const webhookSecret: string = recetarioConfig.webhookSecret || process.env.RECETARIO_WEBHOOK_SECRET || '';

  return async (req: any, res: any) => {
    try {
      if (!verifySignature(req, webhookSecret)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const requestId = req.headers['x-request-id'] as string;
      if (requestId && processedRequestIds.has(requestId)) {
        res.status(200).json({ ok: true, duplicate: true });
        return;
      }

      if (requestId) {
        processedRequestIds.add(requestId);
        if (processedRequestIds.size > MAX_PROCESSED_IDS) {
          const first = processedRequestIds.values().next().value;
          if (first) processedRequestIds.delete(first);
        }
      }

      const { event, data } = req.body;
      const internal = { provider: undefined } as any;

      if (event === 'medical-documents.created') {
        const reference = data?.reference;
        if (reference) {
          const prescriptions = await app.service('prescriptions').find({
            query: { recetarioReference: reference, $limit: 1 },
            paginate: false,
            ...internal,
          } as any);
          const record = Array.isArray(prescriptions) ? prescriptions[0] : null;
          if (record) {
            const documentIds = record.recetarioDocumentIds || [];
            if (data.id) {
              documentIds.push({
                id: data.id,
                type: data.type || 'prescription',
                url: data.url || '',
              });
            }
            await app.service('prescriptions').patch(
              record.id,
              {
                status: 'completed',
                recetarioDocumentIds: documentIds,
              } as any,
              internal
            );
          }
        }
      }

      if (event === 'medical-documents.shared') {
        const reference = data?.reference;
        if (reference) {
          const prescriptions = await app.service('prescriptions').find({
            query: { recetarioReference: reference, $limit: 1 },
            paginate: false,
            ...internal,
          } as any);
          const record = Array.isArray(prescriptions) ? prescriptions[0] : null;
          if (record) {
            await app.service('prescriptions').patch(
              record.id,
              {
                sharedVia: data.channel || null,
                sharedTo: data.recipient || null,
              } as any,
              internal
            );
          }
        }
      }

      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('Recetario webhook error:', error?.message || error);
      res.status(500).json({ ok: false, error: 'Internal error' });
    }
  };
}
