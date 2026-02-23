import { BadRequest, NotFound, Forbidden } from '@feathersjs/errors';
import { PDFDocument } from 'pdf-lib';
import { P12Signer } from '@signpdf/signer-p12';
import signpdf from '@signpdf/signpdf';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import dayjs from 'dayjs';

import type { Application } from '../../declarations';
import { renderMedicalHistoryPdf, PdfRenderOptions, PdfEncounter, PdfStudy } from './pdf-renderer';
import { getPdfTranslations } from '@medapp/translations';

export type ExportContent = 'encounters' | 'studies' | 'both';

export interface SignedExportCreateData {
  patientId: string;
  startDate?: string;
  endDate?: string;
  content?: ExportContent;
  certificatePassword?: string;
  delivery: 'download' | 'email';
  emailTo?: string;
  locale?: string;
}

export interface SignedExportResult {
  success: boolean;
  pdf?: Buffer;
  fileName?: string;
  message?: string;
}

export class SignedExports {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: SignedExportCreateData, params: any): Promise<SignedExportResult> {
    const { patientId, startDate, endDate, content = 'both', certificatePassword, delivery, emailTo, locale } = data;
    const user = params.user;
    const t = getPdfTranslations(locale);

    if (!user) throw new Forbidden('Authentication required');
    if ((user as any).roleId !== 'medic') throw new Forbidden('Only medics can export medical history');
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

    let studies: any[] = [];
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
    let organizationName = 'MedApp';
    if (orgId) {
      try {
        const org = await this.app.service('organizations').get(orgId, internal());
        organizationName = org.name || 'MedApp';
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
    for (const medicId of uniqueMedicIds) {
      try {
        const medicUser = await this.app.service('users').get(medicId, internal());
        const pd = (medicUser as any).personalData || {};
        doctorNames[medicId] = [pd.firstName, pd.lastName].filter(Boolean).join(' ') || (medicUser as any).username || t.unknown;
      } catch {
        doctorNames[medicId] = t.unknown;
      }
    }

    const pdfEncounters: PdfEncounter[] = encounters.map((enc: any) => ({
      id: enc.id,
      date: enc.date,
      doctorName: doctorNames[enc.medicId] || t.unknown,
      data: typeof enc.data === 'string' ? JSON.parse(enc.data) : (enc.data || {}),
    }));

    const pdfStudies: PdfStudy[] = studies.map((study: any) => ({
      id: study.id,
      date: study.date,
      protocol: study.protocol,
      doctorName: doctorNames[study.medicId] || t.unknown,
      referringDoctor: study.referringDoctor || null,
      results: (study.results || []).map((r: any) => ({
        type: r.type,
        data: typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}),
      })),
    }));

    const wantSign = Boolean(certificatePassword);

    const renderOptions: PdfRenderOptions = {
      organizationName,
      doctor: {
        fullName: [personalData.firstName, personalData.lastName].filter(Boolean).join(' ') || (doctorUser as any).username || '',
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

    let pdfBuffer = await renderMedicalHistoryPdf(renderOptions);

    if (wantSign) {
      pdfBuffer = await this.signPdf(pdfBuffer, user.id, certificatePassword!, renderOptions.doctor.fullName, locale);
    }

    const patientName = renderOptions.patient.fullName.replace(/\s+/g, '_') || t.patientFallback;
    const dateStr = dayjs().format('YYYY-MM-DD');
    const fileName = `${t.filePrefix}_${patientName}_${dateStr}.pdf`;

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

      return { success: true, message: `${t.pdfSentTo} ${emailTo}` };
    }

    return { success: true, pdf: pdfBuffer, fileName };
  }

  private async signPdf(
    pdfBuffer: Buffer,
    userId: string,
    certificatePassword: string,
    doctorName: string,
    locale?: string,
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

    const certBase64 = Buffer.isBuffer(certRecord.certificate)
      ? certRecord.certificate.toString('utf-8')
      : certRecord.certificate;
    const p12Buffer = Buffer.from(certBase64, 'base64');

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
}
