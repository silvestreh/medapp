import axios from 'axios';
import type { Application } from '../../declarations';

export interface WhatsAppCreateData {
  to: string;
  documentUrl: string;
  filename?: string;
  caption?: string;
}

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
    const { to, documentUrl, filename = 'document.pdf', caption } = data;

    const phone = to.replace(/[^0-9]/g, '');
    if (!phone) {
      throw new Error('Invalid phone number');
    }
    if (!documentUrl) {
      throw new Error('documentUrl is required');
    }

    const token = this.getToken();
    if (!token) {
      console.warn('[WhatsApp] Whapi token not configured, skipping send');
      return { sent: false };
    }

    // Download the PDF into memory
    const pdfResponse = await axios.get(documentUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const base64 = Buffer.from(pdfResponse.data).toString('base64');
    const mimeType = pdfResponse.headers['content-type'] || 'application/pdf';
    const mediaDataUri = `data:${mimeType};base64,${base64}`;

    // Send via Whapi
    const response = await axios.post(
      `${this.config.apiUrl}/messages/document`,
      {
        to: phone,
        media: mediaDataUri,
        filename,
        caption,
      },
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
