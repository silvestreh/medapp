import pRetry, { AbortError } from 'p-retry';
import type { Application } from '../../declarations';
import logger from '../../logger';
import Sentry from '../../sentry';
import { enqueueWhatsapp } from '../../queues/whatsapp-queue';
import { checkInstanceConnected, getEvolutionConfig } from './utils/check-instance-connected';

export interface WhatsAppDocumentData {
  type?: 'document';
  organizationId: string;
  to: string;
  documentUrl?: string;
  media?: string;
  filename?: string;
  caption?: string;
}

export interface WhatsAppTextData {
  type: 'text';
  organizationId: string;
  to: string;
  body: string;
}

export type WhatsAppCreateData = WhatsAppDocumentData | WhatsAppTextData;

export interface WhatsAppResult {
  sent: boolean;
  queued?: boolean;
  messageId?: string;
  reason?: string;
}

const RETRY_OPTIONS = { retries: 2, factor: 2, minTimeout: 500, maxTimeout: 3000 };

function isConnectionClosedBody(body: string): boolean {
  return /connection closed/i.test(body);
}

export class WhatsApp {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * Normalizes a phone number for WhatsApp.
   * Argentine local numbers (10 digits like 2214567890) get 54 prepended.
   * Numbers starting with 0 get the leading 0 stripped and 54 prepended.
   * Numbers that already include a country code (11+ digits) are left as-is.
   */
  private normalizePhone(digits: string): string {
    let phone = digits.replace(/^0+/, '');
    if (phone.length <= 10) {
      phone = `54${phone}`;
    }
    return phone;
  }

  async create(data: WhatsAppCreateData): Promise<WhatsAppResult> {
    const rawDigits = data.to.replace(/[^0-9]/g, '');
    if (!rawDigits) {
      throw new Error('Invalid phone number');
    }

    const { apiUrl, apiKey } = getEvolutionConfig(this.app);
    if (!apiUrl || !apiKey) {
      logger.warn('[WhatsApp] Evolution API not configured, skipping send');
      return { sent: false, reason: 'evolution-not-configured' };
    }

    const status = await checkInstanceConnected(this.app, data.organizationId);
    if (status.reason === 'no-instance') {
      return { sent: false, reason: 'no-instance' };
    }

    if (!status.connected) {
      const enqueued = await enqueueWhatsapp(data);
      logger.warn(
        `[WhatsApp] Instance not connected for org ${data.organizationId} — ${enqueued ? 'queued' : 'dropped'}`
      );
      return {
        sent: false,
        queued: enqueued,
        reason: 'instance-not-connected',
      };
    }

    try {
      return await this._sendNow(data);
    } catch (err: any) {
      if (err?.__whatsappRetryable === true) {
        const enqueued = await enqueueWhatsapp(data);
        logger.warn(`[WhatsApp] Send failed after retries (${err.message}) — ${enqueued ? 'queued' : 'dropped'}`);
        return { sent: false, queued: enqueued, reason: 'send-failed-evolution' };
      }
      const type = data.type || 'document';
      Sentry.captureException(err, {
        tags: { feature: 'whatsapp', organizationId: data.organizationId, sendType: type },
      });
      return { sent: false, reason: err?.__whatsappReason || 'send-failed' };
    }
  }

  /**
   * Internal send: assumes pre-flight is acceptable; attempts the actual send
   * with pRetry. Throws on failure (the caller — create() or the BullMQ worker
   * — decides how to react). Does NOT enqueue, so it's safe to call from the
   * worker without risk of infinite re-enqueue loops.
   */
  async _sendNow(data: WhatsAppCreateData): Promise<WhatsAppResult> {
    const rawDigits = data.to.replace(/[^0-9]/g, '');
    const phone = this.normalizePhone(rawDigits);
    const { apiUrl, apiKey } = getEvolutionConfig(this.app);

    const instanceName = await this.getInstanceName(data.organizationId);
    if (!instanceName) {
      const err: any = new Error('No WhatsApp instance configured');
      err.__whatsappReason = 'no-instance';
      throw err;
    }

    const type = data.type || 'document';

    if (type === 'text' && 'body' in data) {
      return this.sendTextWithRetry(phone, data.body, instanceName, apiUrl, apiKey);
    }
    return this.sendDocumentWithRetry(phone, data as WhatsAppDocumentData, instanceName, apiUrl, apiKey);
  }

  private async getInstanceName(organizationId: string): Promise<string | null> {
    try {
      const org = await this.app.service('organizations').get(organizationId) as any;
      const waSettings = org.settings?.whatsapp;
      return waSettings?.instanceName || null;
    } catch {
      return null;
    }
  }

  private async sendTextWithRetry(
    phone: string,
    body: string,
    instanceName: string,
    apiUrl: string,
    apiKey: string
  ): Promise<WhatsAppResult> {
    return pRetry(async (attempt) => {
      if (attempt > 1) logger.warn(`[WhatsApp] sendText retry ${attempt}`);
      return this.sendTextOnce(phone, body, instanceName, apiUrl, apiKey);
    }, RETRY_OPTIONS);
  }

  private async sendDocumentWithRetry(
    phone: string,
    data: WhatsAppDocumentData,
    instanceName: string,
    apiUrl: string,
    apiKey: string
  ): Promise<WhatsAppResult> {
    return pRetry(async (attempt) => {
      if (attempt > 1) logger.warn(`[WhatsApp] sendDocument retry ${attempt}`);
      return this.sendDocumentOnce(phone, data, instanceName, apiUrl, apiKey);
    }, RETRY_OPTIONS);
  }

  private async sendTextOnce(
    phone: string,
    body: string,
    instanceName: string,
    apiUrl: string,
    apiKey: string
  ): Promise<WhatsAppResult> {
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: phone, text: body }),
      });
    } catch (err: any) {
      err.__whatsappRetryable = true;
      throw err;
    }

    return this.consumeResponse(response, 'text');
  }

  private async sendDocumentOnce(
    phone: string,
    data: WhatsAppDocumentData,
    instanceName: string,
    apiUrl: string,
    apiKey: string
  ): Promise<WhatsAppResult> {
    const { documentUrl, media, filename = 'document.pdf', caption } = data;

    let base64: string;
    if (media) {
      base64 = media;
    } else if (documentUrl) {
      const pdfResponse = await fetch(documentUrl);
      if (!pdfResponse.ok) {
        const err: any = new Error(`Failed to fetch document from ${documentUrl}`);
        err.__whatsappReason = 'document-fetch-failed';
        throw new AbortError(err);
      }
      const buffer = Buffer.from(await pdfResponse.arrayBuffer());
      base64 = buffer.toString('base64');
    } else {
      const err: any = new Error('Either documentUrl or media is required');
      err.__whatsappReason = 'missing-document';
      throw new AbortError(err);
    }

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          number: phone,
          mediatype: 'document',
          media: base64,
          fileName: filename,
          caption: caption || '',
        }),
      });
    } catch (err: any) {
      err.__whatsappRetryable = true;
      throw err;
    }

    return this.consumeResponse(response, 'document');
  }

  private async consumeResponse(response: Response, kind: 'text' | 'document'): Promise<WhatsAppResult> {
    if (response.ok) {
      const result = await response.json() as any;
      return { sent: true, messageId: result.key?.id };
    }

    const errorBody = await response.text().catch(() => '');
    logger.error(`[WhatsApp] Failed to send ${kind}: ${response.status} ${errorBody}`);

    if (response.status >= 500 || isConnectionClosedBody(errorBody)) {
      const err: any = new Error(`WhatsApp send failed: ${response.status} ${errorBody.slice(0, 200)}`);
      err.__whatsappRetryable = true;
      err.__whatsappStatus = response.status;
      throw err;
    }

    const err: any = new Error(`WhatsApp send failed: ${response.status} ${errorBody.slice(0, 200)}`);
    err.__whatsappStatus = response.status;
    err.__whatsappReason = `evolution-${response.status}`;
    throw new AbortError(err);
  }
}
