import { BadRequest, NotFound, Forbidden } from '@feathersjs/errors';
import { PDFDocument } from 'pdf-lib';
import { P12Signer } from '@signpdf/signer-p12';
import signpdf from '@signpdf/signpdf';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import { pbkdf2Sync, createDecipheriv, createHash } from 'crypto';
import dayjs from 'dayjs';

import type { Application } from '../../declarations';
import { renderMedicalHistoryPdf, PdfRenderOptions, PdfEncounter, PdfStudy } from './pdf-renderer';
import { renderMedicalHistoryHtml } from './html-renderer';
import { getPdfTranslations } from '@athelas/translations';

export type ExportContent = 'encounters' | 'studies' | 'both';

export interface SignedExportCreateData {
  patientId: string;
  studyId?: string;
  startDate?: string;
  endDate?: string;
  content?: ExportContent;
  certificatePassword?: string;
  encryptionPin?: string;
  delivery: 'download' | 'email';
  emailTo?: string;
  locale?: string;
  outputFormat?: 'html';
}

export interface SignedExportResult {
  success: boolean;
  pdf?: Buffer;
  html?: string;
  fileName?: string;
  message?: string;
  hash?: string;
  patientId?: string;
}

export class SignedExports {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: SignedExportCreateData, params: any): Promise<SignedExportResult> {
    const { patientId, studyId, startDate, endDate, content = 'both', certificatePassword, encryptionPin, delivery, emailTo, locale } = data;
    const user = params.user;
    const t = getPdfTranslations(locale);

    if (!user) throw new Forbidden('Authentication required');
    const orgRoleIds: string[] = params.orgRoleIds || [];
    const canExport = orgRoleIds.includes('medic') || orgRoleIds.includes('lab-tech') || orgRoleIds.includes('lab-owner');
    if (!canExport) throw new Forbidden('Only medics, lab techs, and lab owners can export medical history');
    if (!patientId) throw new BadRequest('patientId is required');
    if (delivery === 'email' && !emailTo) throw new BadRequest('emailTo is required for email delivery');

    const internal = () => ({ provider: undefined } as any);
    const includeEncounters = content === 'encounters' || content === 'both';
    const includeStudies = content === 'studies' || content === 'both';

    const patient = await this.app.service('patients').get(patientId, internal());
    if (!patient) throw new NotFound('Patient not found');

    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = dayjs(endDate).endOf('day').toISOString();

    let encounters: any[] = [];
    let studies: any[] = [];

    if (studyId) {
      const singleStudy = await this.app.service('studies').get(studyId, internal());
      studies = [singleStudy];
    } else {
      if (includeEncounters) {
        const encounterQuery: any = { patientId, $sort: { date: 1 }, $limit: 500 };
        if (Object.keys(dateFilter).length > 0) encounterQuery.date = dateFilter;

        const encountersResult = await this.app.service('encounters').find({
          query: encounterQuery,
          paginate: false,
          ...internal(),
        } as any);
        encounters = Array.isArray(encountersResult) ? encountersResult : (encountersResult as any).data || [];
      }

      if (includeStudies) {
        const studyQuery: any = { patientId, $sort: { date: 1 }, $limit: 500 };
        if (Object.keys(dateFilter).length > 0) studyQuery.date = dateFilter;

        const studiesResult = await this.app.service('studies').find({
          query: studyQuery,
          paginate: false,
          ...internal(),
        } as any);
        studies = Array.isArray(studiesResult) ? studiesResult : (studiesResult as any).data || [];
      }
    }

    const doctorUser = await this.app.service('users').get(user.id, internal());
    const mdSettingsResult = await this.app.service('md-settings').find({
      query: { userId: user.id, $limit: 1 },
      paginate: false,
      ...internal(),
    } as any);
    const mdSettings = Array.isArray(mdSettingsResult) ? mdSettingsResult[0] : null;

    const personalData = (doctorUser as any).personalData || {};
    const patientPersonalData = (patient as any).personalData || {};

    const orgId = params.organizationId;
    let organizationName = 'Athelas';
    let organizationLogoUrl: string | undefined;
    if (orgId) {
      try {
        const org = await this.app.service('organizations').get(orgId, internal());
        organizationName = org.name || 'Athelas';
        organizationLogoUrl = (org as any).settings?.healthCenter?.logoUrl || undefined;
      } catch {
        // fall through to default
      }
    }

    const allMedicIds = [
      ...encounters.map((e: any) => e.medicId),
      ...studies.map((s: any) => s.medicId),
    ].filter(Boolean);
    const uniqueMedicIds = [...new Set(allMedicIds)];

    const doctorNames: Record<string, string> = {};
    const doctorTitles: Record<string, string> = {};
    for (const medicId of uniqueMedicIds) {
      try {
        const medicUser = await this.app.service('users').get(medicId, internal());
        const pd = (medicUser as any).personalData || {};
        doctorNames[medicId] = [pd.firstName, pd.lastName].filter(Boolean).join(' ') || (medicUser as any).username || t.unknown;
        const medicMdSettings = (medicUser as any).settings;
        doctorTitles[medicId] = medicMdSettings?.title || (pd.gender === 'female' ? 'Dra.' : 'Dr.');
      } catch {
        doctorNames[medicId] = t.unknown;
        doctorTitles[medicId] = 'Dr.';
      }
    }

    const pdfEncounters: PdfEncounter[] = encounters.map((enc: any) => ({
      id: enc.id,
      date: enc.date,
      doctorName: doctorNames[enc.medicId] || t.unknown,
      doctorTitle: doctorTitles[enc.medicId] || 'Dr.',
      data: typeof enc.data === 'string' ? JSON.parse(enc.data) : (enc.data || {}),
    }));

    const pdfStudies: PdfStudy[] = studies.map((study: any) => ({
      id: study.id,
      date: study.date,
      protocol: study.protocol,
      doctorName: doctorNames[study.medicId] || t.unknown,
      doctorTitle: doctorTitles[study.medicId] || 'Dr.',
      referringDoctor: study.referringDoctor || null,
      results: (study.results || []).map((r: any) => ({
        type: r.type,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}),
      })),
    }));

    const wantSign = Boolean(certificatePassword);

    const renderOptions: PdfRenderOptions = {
      organizationName,
      organizationLogoUrl,
      doctor: {
        fullName: [personalData.firstName, personalData.lastName].filter(Boolean).join(' ') || (doctorUser as any).username || '',
        title: mdSettings?.title || (personalData.gender === 'female' ? 'Dra.' : 'Dr.'),
        specialty: mdSettings?.medicalSpecialty || null,
        nationalLicenseNumber: mdSettings?.nationalLicenseNumber || null,
        stateLicense: mdSettings?.stateLicense || null,
        stateLicenseNumber: mdSettings?.stateLicenseNumber || null,
      },
      patient: {
        fullName: [patientPersonalData.firstName, patientPersonalData.lastName].filter(Boolean).join(' ') || '',
        documentType: patientPersonalData.documentType || null,
        documentValue: patientPersonalData.documentValue || null,
        birthDate: patientPersonalData.birthDate || null,
        medicare: (patient as any).medicare || null,
        medicarePlan: (patient as any).medicarePlan || null,
      },
      encounters: pdfEncounters,
      studies: pdfStudies,
      startDate,
      endDate,
      isSigned: wantSign,
      locale,
      patientGender: patientPersonalData.gender || undefined,
    };

    if (data.outputFormat === 'html' && !wantSign) {
      const html = renderMedicalHistoryHtml(renderOptions);
      return { success: true, html };
    }

    let pdfBuffer = await renderMedicalHistoryPdf(renderOptions);

    let hash: string | undefined;

    if (wantSign) {
      pdfBuffer = await this.signPdf(pdfBuffer, user.id, certificatePassword!, renderOptions.doctor.fullName, locale, encryptionPin);
      hash = createHash('sha256').update(pdfBuffer).digest('hex');
    }

    const patientName = renderOptions.patient.fullName.replace(/\s+/g, '_') || t.patientFallback;
    const dateStr = dayjs().format('YYYY-MM-DD');
    const fileName = `${t.filePrefix}_${patientName}_${dateStr}.pdf`;

    if (wantSign && hash) {
      await this.app.service('document-signatures').create({
        hash,
        signedById: user.id,
        patientId,
        organizationId: params.organizationId || null,
        signerName: renderOptions.doctor.fullName,
        signedAt: new Date(),
        fileName,
        content,
        studyId: studyId || null,
      }, { provider: undefined } as any);
    }

    if (delivery === 'email') {
      await this.app.service('mailer').create({
        template: 'medical-history-export',
        to: emailTo!,
        subject: `${t.emailSubjectPrefix} — ${renderOptions.patient.fullName}`,
        data: {
          patientName: renderOptions.patient.fullName,
          doctorName: renderOptions.doctor.fullName,
          organizationName,
          isSigned: wantSign,
        },
        attachments: [{
          filename: fileName,
          data: pdfBuffer,
          contentType: 'application/pdf',
        }],
      } as any);

      return { success: true, message: `${t.pdfSentTo} ${emailTo}`, hash, patientId };
    }

    return { success: true, pdf: pdfBuffer, fileName, hash, patientId };
  }

  private async signPdf(
    pdfBuffer: Buffer,
    userId: string,
    certificatePassword: string,
    doctorName: string,
    locale?: string,
    encryptionPin?: string,
  ): Promise<Buffer> {
    const certRecords = await this.app.service('signing-certificates').find({
      query: { userId },
      paginate: false,
      provider: undefined,
    } as any) as any[];

    const certRecord = Array.isArray(certRecords) ? certRecords[0] : null;
    if (!certRecord) {
      throw new BadRequest('No signing certificate found. Upload one in your profile.');
    }

    if (certRecord.isClientEncrypted && !encryptionPin) {
      throw new BadRequest('Encryption PIN is required for PIN-protected certificates.');
    }

    const certBase64 = Buffer.isBuffer(certRecord.certificate)
      ? certRecord.certificate.toString('utf-8')
      : certRecord.certificate;

    let p12Buffer: Buffer;
    if (certRecord.isClientEncrypted) {
      p12Buffer = this.decryptClientEncryptedCert(certBase64, encryptionPin!);
    } else {
      p12Buffer = Buffer.from(certBase64, 'base64');
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    const signT = getPdfTranslations(locale);
    pdflibAddPlaceholder({
      pdfDoc,
      pdfPage: lastPage,
      reason: `${signT.signingReason} ${doctorName}`,
      contactInfo: '',
      name: `Dr. ${doctorName}`,
      location: 'Argentina',
      subFilter: SUBFILTER_ETSI_CADES_DETACHED,
      widgetRect: [0, 0, 0, 0],
    });

    const pdfWithPlaceholder = Buffer.from(await pdfDoc.save());

    const signer = new P12Signer(p12Buffer, { passphrase: certificatePassword });
    return signpdf.sign(pdfWithPlaceholder, signer);
  }

  private decryptClientEncryptedCert(base64Data: string, pin: string): Buffer {
    const SALT_LENGTH = 16;
    const IV_LENGTH = 12;
    const TAG_LENGTH = 16;

    const packed = Buffer.from(base64Data, 'base64');
    if (packed.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1) {
      throw new BadRequest('Encrypted certificate data is corrupted.');
    }

    const salt = packed.subarray(0, SALT_LENGTH);
    const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const ciphertextWithTag = packed.subarray(SALT_LENGTH + IV_LENGTH);

    const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - TAG_LENGTH);
    const authTag = ciphertextWithTag.subarray(ciphertextWithTag.length - TAG_LENGTH);

    const key = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted;
    } catch {
      throw new BadRequest('Invalid PIN. Could not decrypt the certificate.');
    }
  }
}
