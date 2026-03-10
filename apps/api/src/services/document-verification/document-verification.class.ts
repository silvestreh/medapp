import { BadRequest } from '@feathersjs/errors';
import { createHash } from 'crypto';

import type { Application } from '../../declarations';

export interface VerificationResult {
  isValid: boolean;
  hashMatch: boolean;
  signaturePresent: boolean;
  signerName: string | null;
  signedAt: string | null;
  patientId: string | null;
  signedById: string | null;
  storedRecord: boolean;
  message: string;
}

export class DocumentVerification {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: any, params: any): Promise<VerificationResult> {
    const file = (params as any).file as Express.Multer.File | undefined;
    if (!file) {
      throw new BadRequest('No PDF file provided');
    }

    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequest('File must be a PDF');
    }

    const pdfBuffer = file.buffer;
    const hash = createHash('sha256').update(pdfBuffer).digest('hex');

    const records = await this.app.service('document-signatures').find({
      query: { hash },
      paginate: false,
      provider: undefined,
    } as any) as any[];

    const record = Array.isArray(records) ? records[0] : null;

    const signatureInfo = await this.extractSignatureInfo(pdfBuffer);

    if (record) {
      return {
        isValid: true,
        hashMatch: true,
        signaturePresent: signatureInfo.present,
        signerName: record.signerName,
        signedAt: record.signedAt,
        patientId: record.patientId,
        signedById: record.signedById,
        storedRecord: true,
        message: 'Document is authentic and has not been tampered with.',
      };
    }

    return {
      isValid: false,
      hashMatch: false,
      signaturePresent: signatureInfo.present,
      signerName: signatureInfo.name,
      signedAt: signatureInfo.date,
      patientId: null,
      signedById: null,
      storedRecord: false,
      message: signatureInfo.present
        ? 'Document contains a digital signature but no matching record was found in our system.'
        : 'No matching record found and no digital signature detected.',
    };
  }

  private async extractSignatureInfo(pdfBuffer: Buffer): Promise<{
    present: boolean;
    name: string | null;
    date: string | null;
  }> {
    try {
      // Search for signature references in the raw PDF bytes
      const pdfString = pdfBuffer.toString('latin1');

      const sigPresent = pdfString.includes('/Type /Sig') || pdfString.includes('/SubFilter /ETSI');

      let signerName: string | null = null;
      let signDate: string | null = null;

      if (sigPresent) {
        // Extract /Name field from signature dictionary
        const nameMatch = pdfString.match(/\/Name\s*\(([^)]+)\)/);
        if (nameMatch) {
          signerName = nameMatch[1];
        }

        // Extract /M (modification/signing date) field
        const dateMatch = pdfString.match(/\/M\s*\(D:(\d{14})/);
        if (dateMatch) {
          const d = dateMatch[1];
          const year = d.substring(0, 4);
          const month = d.substring(4, 6);
          const day = d.substring(6, 8);
          const hour = d.substring(8, 10);
          const min = d.substring(10, 12);
          const sec = d.substring(12, 14);
          signDate = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
        }
      }

      return { present: sigPresent, name: signerName, date: signDate };
    } catch {
      return { present: false, name: null, date: null };
    }
  }
}
