import type { Application } from '../../declarations';
import type { WhatsAppInstanceSettings } from '../whatsapp-instances/whatsapp-instances.class';

export interface WhatsAppDocumentData {
  type?: 'document';
  organizationId: string;
  to: string;
  documentUrl: string;
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
  messageId?: string;
}

interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

export class WhatsApp {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  private getEvolutionConfig(): EvolutionConfig {
    const config = (this.app.get as any)('evolution') || {};
    const apiUrl = config.apiUrl || process.env.EVOLUTION_API_URL || '';
    const apiKey = config.apiKey || process.env.EVOLUTION_API_KEY || '';
    return { apiUrl: apiUrl.replace(/\/$/, ''), apiKey };
  }

  private async getInstanceName(organizationId: string): Promise<string | null> {
    try {
      const org = await this.app.service('organizations').get(organizationId) as any;
      const waSettings = org.settings?.whatsapp as WhatsAppInstanceSettings | undefined;
      if (!waSettings?.instanceName || !waSettings?.connected) {
        return null;
      }
      return waSettings.instanceName;
    } catch {
      return null;
    }
  }

  /**
   * Normalizes a phone number for WhatsApp.
   * Argentine local numbers (10 digits like 2216412898) get 54 prepended.
   * Numbers starting with 0 get the leading 0 stripped and 54 prepended.
   * Numbers that already include a country code (11+ digits) are left as-is.
   */
  private normalizePhone(digits: string): string {
    // Strip leading 0 (common in local Argentine dialing)
    let phone = digits.replace(/^0+/, '');

    // Argentine local numbers are 10 digits (area code + number).
    // If the number is 10 digits or fewer, assume Argentina (+54).
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
    const phone = this.normalizePhone(rawDigits);

    const { apiUrl, apiKey } = this.getEvolutionConfig();
    if (!apiUrl || !apiKey) {
      console.warn('[WhatsApp] Evolution API not configured, skipping send');
      return { sent: false };
    }

    const instanceName = await this.getInstanceName(data.organizationId);
    if (!instanceName) {
      console.warn(`[WhatsApp] No connected WhatsApp instance for organization ${data.organizationId}, skipping send`);
      return { sent: false };
    }

    const type = data.type || 'document';

    if (type === 'text' && 'body' in data) {
      return this.sendText(phone, data.body, instanceName, apiUrl, apiKey);
    }

    return this.sendDocument(phone, data as WhatsAppDocumentData, instanceName, apiUrl, apiKey);
  }

  private async sendText(
    phone: string,
    body: string,
    instanceName: string,
    apiUrl: string,
    apiKey: string
  ): Promise<WhatsAppResult> {
    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: phone,
        text: body,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[WhatsApp] Failed to send text message:', errorBody);
      return { sent: false };
    }

    const result = await response.json() as any;
    return { sent: true, messageId: result.key?.id };
  }

  private async sendDocument(
    phone: string,
    data: WhatsAppDocumentData,
    instanceName: string,
    apiUrl: string,
    apiKey: string
  ): Promise<WhatsAppResult> {
    const { documentUrl, filename = 'document.pdf', caption } = data;

    if (!documentUrl) {
      throw new Error('documentUrl is required');
    }

    // Fetch the document and convert to base64
    const pdfResponse = await fetch(documentUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch document from ${documentUrl}`);
    }
    const buffer = Buffer.from(await pdfResponse.arrayBuffer());
    const base64 = buffer.toString('base64');

    const response = await fetch(`${apiUrl}/message/sendMedia/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: phone,
        mediatype: 'document',
        media: base64,
        fileName: filename,
        caption: caption || '',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[WhatsApp] Failed to send document:', errorBody);
      return { sent: false };
    }

    const result = await response.json() as any;
    return { sent: true, messageId: result.key?.id };
  }
}
