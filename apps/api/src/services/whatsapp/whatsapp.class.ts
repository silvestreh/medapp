import axios from 'axios';
import type { Application } from '../../declarations';

export interface WhatsAppDocumentData {
  type: 'document';
  to: string;
  documentUrl: string;
  filename?: string;
  caption?: string;
}

export interface WhatsAppTextData {
  type: 'text';
  to: string;
  body: string;
}

export type WhatsAppCreateData = WhatsAppDocumentData | WhatsAppTextData;

export interface WhatsAppResult {
  sent: boolean;
  messageId?: string;
}

export class WhatsApp {
  app: Application;
  config: { token: string; apiUrl: string };

  constructor(app: Application) {
    this.app = app;
    this.config = app.get('whapi') as { token: string; apiUrl: string };
  }

  private getToken(): string {
    const config = (this.app.get as any)('whapi') || {};
    return config.token || process.env.WHAPI_TOKEN || '';
  }

  async create(data: WhatsAppCreateData): Promise<WhatsAppResult> {
    const phone = data.to.replace(/[^0-9]/g, '');
    if (!phone) {
      throw new Error('Invalid phone number');
    }

    const token = this.getToken();
    if (!token) {
      console.warn('[WhatsApp] Whapi token not configured, skipping send');
      return { sent: false };
    }

    const type = data.type || 'document';

    if (type === 'text' && 'body' in data) {
      return this.sendText(phone, data.body, token);
    }

    return this.sendDocument(phone, data as WhatsAppDocumentData, token);
  }

  private async sendText(phone: string, body: string, token: string): Promise<WhatsAppResult> {
    const response = await axios.post(
      `${this.config.apiUrl}/messages/text`,
      { to: phone, body },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return { sent: true, messageId: response.data?.message?.id };
  }

  private async sendDocument(phone: string, data: WhatsAppDocumentData, token: string): Promise<WhatsAppResult> {
    const { documentUrl, filename = 'document.pdf', caption } = data;

    if (!documentUrl) {
      throw new Error('documentUrl is required');
    }

    const pdfResponse = await axios.get(documentUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const base64 = Buffer.from(pdfResponse.data).toString('base64');
    const mimeType = pdfResponse.headers['content-type'] || 'application/pdf';
    const mediaDataUri = `data:${mimeType};base64,${base64}`;

    const response = await axios.post(
      `${this.config.apiUrl}/messages/document`,
      { to: phone, media: mediaDataUri, filename, caption },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return { sent: true, messageId: response.data?.message?.id };
  }
}
