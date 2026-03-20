import { BadRequest, Forbidden } from '@feathersjs/errors';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { APP_SLUG } from '@athelas/brand';

import type { Application } from '../../declarations';
import { mapDoctorData, mapPatientData, mapDoctorForAPI, mapPatientForAPI, checkDoctorReadiness, sanitizeDocumentNumber, mapGender, reverseMapGender, reverseMapProvince, formatBirthDate } from './data-mapper';
import * as recetarioClient from './recetario-client';

type RecetarioAction =
  | 'quick-link'
  | 'prescribe'
  | 'order'
  | 'cancel'
  | 'share'
  | 'check-readiness'
  | 'sync-insurances'
  | 'search-medications'
  | 'register-health-center'
  | 'register-user'
  | 'get-patient-data';

export interface RecetarioCreateData {
  action: RecetarioAction;
  patientId?: string;
  prescriptionId?: string;
  recetarioDocumentId?: number;
  medications?: any[];
  diagnosis?: string;
  content?: string;
  recurring?: { days: number; quantity: number };
  hiv?: boolean;
  patientData?: {
    documentValue?: string;
    documentType?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    birthDate?: string;
    email?: string;
    phone?: string;
    healthInsuranceName?: string;
    insuranceNumber?: string;
    medicareId?: string;
  };
  shareChannel?: 'whatsapp' | 'email';
  shareRecipient?: string;
  documentIds?: number[];
  pdfUrl?: string;
  medicId?: string;
  healthCenter?: any;
  search?: string;
}

export interface RecetarioResult {
  success: boolean;
  [key: string]: any;
}

export class Recetario {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async create(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const { action } = data;
    if (!action) throw new BadRequest('Action is required');

    const user = params.user;
    if (!user) throw new Forbidden('Authentication required');

    switch (action) {
    case 'quick-link':
      return this.handleQuickLink(data, params);
    case 'prescribe':
      return this.handlePrescribe(data, params);
    case 'order':
      return this.handleOrder(data, params);
    case 'cancel':
      return this.handleCancel(data, params);
    case 'share':
      return this.handleShare(data, params);
    case 'check-readiness':
      return this.handleCheckReadiness(data, params);
    case 'sync-insurances':
      return this.handleSyncInsurances();
    case 'search-medications':
      return this.handleSearchMedications(data);
    case 'register-health-center':
      return this.handleRegisterHealthCenter(data, params);
    case 'register-user':
      return this.handleRegisterUser(data, params);
    case 'get-patient-data':
      return this.handleGetPatientData(data, params);
    default:
      throw new BadRequest(`Unsupported action: ${action}`);
    }
  }

  private internal() {
    return { provider: undefined } as any;
  }

  private async resolveEffectiveMedicId(data: RecetarioCreateData, params: any): Promise<string> {
    const userId = String(params.user.id);
    if (!data.medicId || data.medicId === userId) return userId;

    // Verify the target medic belongs to the same organization
    const internal = this.internal();
    const orgUsers = await this.app.service('organization-users').find({
      query: { organizationId: params.organizationId, userId: data.medicId, $limit: 1 },
      paginate: false,
      ...internal,
    } as any);
    if (!Array.isArray(orgUsers) || orgUsers.length === 0) {
      throw new Forbidden('Target medic does not belong to this organization');
    }

    // Verify the target user has the medic role
    const userRoles = await this.app.service('user-roles').find({
      query: { userId: data.medicId, organizationId: params.organizationId, roleId: 'medic', $limit: 1 },
      paginate: false,
      ...internal,
    } as any);
    if (!Array.isArray(userRoles) || userRoles.length === 0) {
      throw new Forbidden('Target user is not a medic');
    }

    // Verify the medic has delegated prescription authority to this user
    const delegations = await this.app.service('prescription-delegations').find({
      query: {
        medicId: data.medicId,
        prescriberId: userId,
        organizationId: params.organizationId,
        $limit: 1,
      },
      paginate: false,
      ...internal,
    } as any);
    if (!Array.isArray(delegations) || delegations.length === 0) {
      throw new Forbidden('This medic has not granted you prescription delegation');
    }

    return data.medicId;
  }

  private async getDoctorData(userId: string) {
    const internal = this.internal();

    const doctorUser = await this.app.service('users').get(userId, internal);
    const personalData = (doctorUser as any).personalData || {};

    const userContactData = await this.app.service('user-contact-data').find({
      query: { ownerId: userId, $limit: 1 },
      paginate: false,
      ...internal,
    } as any);
    const contactLink = Array.isArray(userContactData) ? userContactData[0] : null;
    let contactData: any = {};
    if (contactLink?.contactDataId) {
      contactData = await this.app.service('contact-data').get(contactLink.contactDataId, internal);
    }

    const mdSettingsResult = await this.app.service('md-settings').find({
      query: { userId, $limit: 1 },
      paginate: false,
      ...internal,
    } as any);
    const mdSettings = Array.isArray(mdSettingsResult) ? mdSettingsResult[0] : null;
    if (!mdSettings) throw new BadRequest('Medical settings not found. Complete your profile first.');

    return { personalData, contactData, mdSettings };
  }

  private async getPatientData(patientId: string) {
    const internal = this.internal();

    // patients.get already populates personalData and contactData via after hooks
    const patient = await this.app.service('patients').get(patientId, internal);

    // Get insurer name if patient has medicare
    let insurerName: string | null = null;
    if ((patient as any).medicareId) {
      try {
        const prepaga = await this.app.service('prepagas').get((patient as any).medicareId, internal);
        insurerName = (prepaga as any).recetarioHealthInsuranceName || (prepaga as any).shortName || null;
      } catch {
        // prepaga not found
      }
    }

    return {
      personalData: (patient as any).personalData || {},
      contactData: (patient as any).contactData || {},
      medicare: (patient as any).medicare || null,
      medicarePlan: (patient as any).medicarePlan || null,
      medicareNumber: (patient as any).medicareNumber || null,
      medicareId: (patient as any).medicareId || null,
      insurerName,
    };
  }

  private async getOrgRecetarioSettings(params: any): Promise<{ enabled: boolean; healthCenterId: number | null }> {
    if (!params.organizationId) {
      return { enabled: false, healthCenterId: null };
    }
    const org = await this.app.service('organizations').get(params.organizationId, this.internal());
    const settings = (org as any)?.settings?.recetario;
    return {
      enabled: settings?.enabled || false,
      healthCenterId: settings?.healthCenterId || null,
    };
  }

  private async handleQuickLink(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const { patientId } = data;
    if (!patientId) throw new BadRequest('patientId is required');

    const effectiveMedicId = await this.resolveEffectiveMedicId(data, params);
    const doctor = await this.getDoctorData(effectiveMedicId);
    const patient = await this.getPatientData(patientId);
    const orgSettings = await this.getOrgRecetarioSettings(params);

    const reference = `${APP_SLUG}-${randomUUID()}`;

    const payload: recetarioClient.QuickLinkPayload = {
      professional: mapDoctorData(doctor),
      patient: mapPatientData(patient),
      reference,
    };

    if (orgSettings.healthCenterId) {
      payload.healthCenter = { id: orgSettings.healthCenterId };
    }

    const response = await recetarioClient.createQuickLinks(payload);

    // Store prescription record
    await this.app.service('prescriptions').create({
      organizationId: params.organizationId || null,
      medicId: effectiveMedicId,
      patientId,
      recetarioReference: reference,
      type: 'prescription',
      quickLinkUrl: response.prescriptionsLink || response.ordersLink || null,
      quickLinkExpiresAt: dayjs().add(20, 'minute').toDate(),
      status: 'pending',
    } as any, this.internal());

    return {
      success: true,
      prescriptionsLink: response.prescriptionsLink,
      ordersLink: response.ordersLink,
      reference,
    };
  }

  private async handlePrescribe(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const { patientId, medications, diagnosis, recurring, hiv, patientData: patientOverride } = data;
    if (!patientId) throw new BadRequest('patientId is required');
    if (!medications || medications.length === 0) throw new BadRequest('At least one medication is required');

    const effectiveMedicId = await this.resolveEffectiveMedicId(data, params);
    const doctor = await this.getDoctorData(effectiveMedicId);
    if (process.env.NODE_ENV !== 'production') {
      const originalEmail = doctor.contactData?.email || 'unknown';
      doctor.contactData = { ...doctor.contactData, email: `${originalEmail}@recetario.com.ar` };
    }
    const { resolved: patient, mhsPatient } = await this.resolvePatientWithOverride(patientId, patientOverride);
    await this.upsertRecetarioPatient(patient);
    await this.patchAthelasPatientIfChanged(patientId, mhsPatient, patientOverride);
    const orgSettings = await this.getOrgRecetarioSettings(params);

    const reference = `${APP_SLUG}-${randomUUID()}`;
    const recetarioUserId = doctor.mdSettings.recetarioUserId as number | null | undefined;

    const doctorPayload = mapDoctorForAPI(doctor);
    if (orgSettings.healthCenterId && !recetarioUserId) {
      doctorPayload.healthCenterId = orgSettings.healthCenterId;
    }

    const payload: recetarioClient.PrescriptionPayload = {
      ...(recetarioUserId ? { userId: recetarioUserId } : { doctor: doctorPayload }),
      date: dayjs().format('YYYY-MM-DD'),
      patient: mapPatientForAPI(patient),
      method: 'manual',
      diagnosis: diagnosis || '',
      reference,
      hiv: hiv || undefined,
      recurring,
      medicines: (medications || []).map((m: any) => ({
        externalId: m.externalId || undefined,
        quantity: m.quantity,
        longTerm: m.longTerm || m.longTermTreatment || false,
        posology: m.posology || undefined,
        genericOnly: m.genericOnly || undefined,
        brandRecommendation: m.brandRecommendation || undefined,
        requiresDuplicate: m.requiresDuplicate || undefined,
        text: m.text || undefined,
      })),
    };

    // Create DB record first so webhooks can find it
    const prescriptionRecord = await this.app.service('prescriptions').create({
      organizationId: params.organizationId || null,
      medicId: effectiveMedicId,
      patientId,
      recetarioReference: reference,
      recetarioDocumentIds: [],
      type: 'prescription',
      status: 'pending',
      content: {
        diagnosis,
        medicines: (medications || []).map((m: any) => ({
          text: m.text || '',
          quantity: m.quantity,
          posology: m.posology || null,
          longTerm: m.longTerm || false,
          genericOnly: m.genericOnly || null,
        })),
      },
    } as any, this.internal());

    let response: any;
    try {
      response = await recetarioClient.createPrescription(payload);
    } catch {
      try {
        response = await recetarioClient.createPrescription(payload);
      } catch (retryError) {
        await this.app.service('prescriptions').patch(
          (prescriptionRecord as any).id,
          { status: 'error' } as any,
          this.internal()
        );
        throw retryError;
      }
    }

    if (response.id) {
      await this.app.service('prescriptions').patch(
        (prescriptionRecord as any).id,
        {
          status: 'completed',
          recetarioDocumentIds: [{ id: response.id, type: 'prescription', url: response.url || '' }],
        } as any,
        this.internal()
      );
    }

    return { success: true, ...response, reference, prescriptionId: (prescriptionRecord as any).id, recetarioDocumentId: response.id ?? null };
  }

  private async handleOrder(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const { patientId, content, diagnosis, patientData: patientOverride } = data;
    if (!patientId) throw new BadRequest('patientId is required');
    if (!content) throw new BadRequest('Order content is required');

    const effectiveMedicId = await this.resolveEffectiveMedicId(data, params);
    const doctor = await this.getDoctorData(effectiveMedicId);
    if (process.env.NODE_ENV !== 'production') {
      const originalEmail = doctor.contactData?.email || 'unknown';
      doctor.contactData = { ...doctor.contactData, email: `${originalEmail}@recetario.com.ar` };
    }
    const { resolved: patient, mhsPatient } = await this.resolvePatientWithOverride(patientId, patientOverride);
    await this.upsertRecetarioPatient(patient);
    await this.patchAthelasPatientIfChanged(patientId, mhsPatient, patientOverride);
    const orgSettings = await this.getOrgRecetarioSettings(params);

    const reference = `${APP_SLUG}-${randomUUID()}`;
    const recetarioUserId = doctor.mdSettings.recetarioUserId as number | null | undefined;

    const doctorPayload = mapDoctorForAPI(doctor);
    if (orgSettings.healthCenterId && !recetarioUserId) {
      doctorPayload.healthCenterId = orgSettings.healthCenterId;
    }

    const payload: recetarioClient.OrderPayload = {
      ...(recetarioUserId ? { userId: recetarioUserId } : { doctor: doctorPayload }),
      date: dayjs().format('YYYY-MM-DD'),
      patient: mapPatientForAPI(patient),
      medicine: content,
      diagnosis: diagnosis || '',
      reference,
    };

    // Create DB record first so webhooks can find it
    const prescriptionRecord = await this.app.service('prescriptions').create({
      organizationId: params.organizationId || null,
      medicId: effectiveMedicId,
      patientId,
      recetarioReference: reference,
      recetarioDocumentIds: [],
      type: 'order',
      status: 'pending',
      content: {
        diagnosis,
        orderText: content,
      },
    } as any, this.internal());

    let response: any;
    try {
      response = await recetarioClient.createOrder(payload);
    } catch {
      try {
        response = await recetarioClient.createOrder(payload);
      } catch (retryError) {
        await this.app.service('prescriptions').patch(
          (prescriptionRecord as any).id,
          { status: 'error' } as any,
          this.internal()
        );
        throw retryError;
      }
    }

    if (response.id) {
      await this.app.service('prescriptions').patch(
        (prescriptionRecord as any).id,
        {
          status: 'completed',
          recetarioDocumentIds: [{ id: response.id, type: 'order', url: response.url || '' }],
        } as any,
        this.internal()
      );
    }

    return { success: true, ...response, reference, prescriptionId: (prescriptionRecord as any).id, recetarioDocumentId: response.id ?? null };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleCancel(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const { prescriptionId, recetarioDocumentId } = data;
    if (!prescriptionId && !recetarioDocumentId) {
      throw new BadRequest('prescriptionId or recetarioDocumentId is required');
    }

    if (recetarioDocumentId) {
      await recetarioClient.cancelPrescription(recetarioDocumentId);
    }

    if (prescriptionId) {
      await this.app.service('prescriptions').remove(prescriptionId, this.internal());
    }

    return { success: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleShare(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const { shareChannel, shareRecipient, prescriptionId, pdfUrl } = data;
    if (!shareChannel) throw new BadRequest('shareChannel required');
    if (!shareRecipient) throw new BadRequest('shareRecipient required');

    if (shareChannel === 'whatsapp') {
      if (!pdfUrl) throw new BadRequest('pdfUrl required for WhatsApp sharing');
      await this.app.service('whatsapp').create({
        organizationId: params.organizationId,
        to: shareRecipient,
        documentUrl: pdfUrl,
        filename: 'receta.pdf',
      });
    } else {
      if (!pdfUrl) throw new BadRequest('pdfUrl required for email sharing');

      // Download PDF from Recetario
      const axios = (await import('axios')).default;
      const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const pdfBuffer = Buffer.from(pdfResponse.data);

      // Resolve names for the email template
      let patientName = '';
      let doctorName = '';
      let organizationName = '';
      let documentType: 'prescription' | 'order' = 'prescription';

      if (prescriptionId) {
        try {
          const prescription = await this.app.service('prescriptions').get(prescriptionId, this.internal());
          documentType = (prescription as any).type === 'order' ? 'order' : 'prescription';

          if ((prescription as any).patientId) {
            const patient = await this.app.service('patients').get((prescription as any).patientId, this.internal());
            const pd = (patient as any).personalData || {};
            patientName = [pd.firstName, pd.lastName].filter(Boolean).join(' ');
          }
          if ((prescription as any).medicId) {
            const medic = await this.app.service('users').get((prescription as any).medicId, this.internal());
            const pd = (medic as any).personalData || {};
            doctorName = [pd.firstName, pd.lastName].filter(Boolean).join(' ');
          }
          if ((prescription as any).organizationId) {
            const org = await this.app.service('organizations').get((prescription as any).organizationId, this.internal());
            organizationName = (org as any).name || '';
          }
        } catch {
          // Non-fatal — send email with empty names
        }
      }

      const filename = documentType === 'order' ? 'orden.pdf' : 'receta.pdf';

      await this.app.service('mailer').create({
        template: 'prescription-share',
        to: shareRecipient,
        subject: documentType === 'order' ? 'Nueva orden médica' : 'Nueva receta',
        data: { patientName, doctorName, organizationName, documentType },
        attachments: [{ filename, data: pdfBuffer, contentType: 'application/pdf' }],
      });
    }

    if (prescriptionId) {
      await this.app.service('prescriptions').patch(
        prescriptionId,
        { sharedVia: shareChannel, sharedTo: shareRecipient } as any,
        this.internal()
      );
    }

    return { success: true };
  }

  private async handleCheckReadiness(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const effectiveMedicId = await this.resolveEffectiveMedicId(data, params);
    const doctor = await this.getDoctorData(effectiveMedicId);
    const result = checkDoctorReadiness(doctor);
    return { success: true, ...result };
  }

  private async handleSyncInsurances(): Promise<RecetarioResult> {
    const insurances = await recetarioClient.getHealthInsurances();
    return { success: true, insurances };
  }

  private async handleSearchMedications(data: RecetarioCreateData): Promise<RecetarioResult> {
    const { search } = data;
    if (!search || search.length < 3) throw new BadRequest('Search term must be at least 3 characters long');
    const medications = await recetarioClient.getMedications(search);
    return { success: true, medications };
  }

  private async handleRegisterHealthCenter(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const { healthCenter } = data;
    if (!healthCenter) throw new BadRequest('healthCenter data is required');

    // Check for existing health center by email before creating
    const healthCenters = await recetarioClient.getHealthCenters();
    const match = healthCenters.find(
      (center: any) => center.email?.toLowerCase() === healthCenter.email?.toLowerCase()
    );
    const response = match?.id ? match : await recetarioClient.createHealthCenter(healthCenter);

    // Update org settings with health center ID
    if (response.id && params.organizationId) {
      const org = await this.app.service('organizations').get(params.organizationId, this.internal());
      const settings = (org as any).settings || {};
      settings.recetario = { ...settings.recetario, healthCenterId: response.id };
      await this.app.service('organizations').patch(
        params.organizationId,
        { settings } as any,
        this.internal()
      );
    }

    // After registering a health center, sync all org medics in the background
    if (response.id && params.organizationId) {
      this.syncOrgMedics(params.organizationId, response.id).catch(() => {});
    }

    return { success: true, ...response };
  }

  private async syncOrgMedics(organizationId: string, healthCenterId: number): Promise<void> {
    const internal = this.internal();

    // Find all medics in the org
    const orgUsers = await this.app.service('organization-users').find({
      query: { organizationId, $limit: 200 },
      paginate: false,
      ...internal,
    } as any);
    if (!Array.isArray(orgUsers) || orgUsers.length === 0) return;

    for (const orgUser of orgUsers) {
      try {
        const mdSettingsResult = await this.app.service('md-settings').find({
          query: { userId: String(orgUser.userId), $limit: 1 },
          paginate: false,
          ...internal,
        } as any);
        const mdSettings = Array.isArray(mdSettingsResult) ? mdSettingsResult[0] : null;
        if (!mdSettings?.id) continue;

        // Skip if already fully synced
        const needsBackfill = !mdSettings.recetarioTitle || !mdSettings.recetarioProvince;
        if (mdSettings.recetarioUserId && !needsBackfill) continue;

        const user = await this.app.service('users').get(orgUser.userId, internal);
        const personalData = (user as any).personalData || {};
        const docNum = sanitizeDocumentNumber(personalData.documentValue);
        if (!docNum) continue;

        const recetarioUsers = await recetarioClient.getUsersByDocumentNumber(docNum, healthCenterId);
        const recetarioUser = Array.isArray(recetarioUsers) && recetarioUsers[0]?.id ? recetarioUsers[0] : null;
        if (!recetarioUser) continue;

        const patchData: Record<string, any> = {};
        if (!mdSettings.recetarioUserId) patchData.recetarioUserId = recetarioUser.id;
        if (!mdSettings.recetarioTitle && recetarioUser.title) patchData.recetarioTitle = recetarioUser.title;
        if (!mdSettings.recetarioProvince && recetarioUser.province) patchData.recetarioProvince = reverseMapProvince(recetarioUser.province);

        if (Object.keys(patchData).length > 0) {
          await this.app.service('md-settings').patch(mdSettings.id, patchData as any, internal);
        }
      } catch {
        // Non-fatal per medic
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async handleGetPatientData(data: RecetarioCreateData, _params: any): Promise<RecetarioResult> {
    const { patientId } = data;
    if (!patientId) throw new BadRequest('patientId is required');

    const patient = await this.getPatientData(patientId);

    return {
      success: true,
      recetarioData: null,
      matchedPrepagaId: null,
      mhsPatientData: {
        documentValue: patient.personalData.documentValue || '',
        documentType: patient.personalData.documentType || 'DNI',
        firstName: patient.personalData.firstName || '',
        lastName: patient.personalData.lastName || '',
        gender: patient.personalData.gender || '',
        birthDate: patient.personalData.birthDate ? formatBirthDate(patient.personalData.birthDate) : '',
        email: patient.contactData.email || '',
        phone: ((patient.contactData as any).phoneNumber || '').replace(/^tel:/i, ''),
        medicareId: patient.medicareId || '',
        insuranceNumber: patient.medicareNumber || '',
      },
    };
  }

  private async resolvePatientWithOverride(patientId: string, override: RecetarioCreateData['patientData']) {
    const mhsPatient = await this.getPatientData(patientId);

    if (!override) return { resolved: mhsPatient, mhsPatient };

    // Determine insurer name: from override.healthInsuranceName, or look up prepaga by override.medicareId
    let insurerName = override.healthInsuranceName || mhsPatient.insurerName;
    if (override.medicareId && !override.healthInsuranceName) {
      try {
        const prepaga = await this.app.service('prepagas').get(override.medicareId, this.internal());
        insurerName = (prepaga as any).recetarioHealthInsuranceName || (prepaga as any).shortName || insurerName;
      } catch { /* non-fatal */ }
    }

    const resolved = {
      personalData: {
        ...mhsPatient.personalData,
        ...(override.firstName && { firstName: override.firstName }),
        ...(override.lastName && { lastName: override.lastName }),
        ...(override.documentValue && { documentValue: override.documentValue }),
        ...(override.documentType && { documentType: override.documentType }),
        ...(override.gender && { gender: override.gender }),
        ...(override.birthDate && { birthDate: override.birthDate }),
      },
      contactData: {
        ...mhsPatient.contactData,
        ...(override.email && { email: override.email }),
      },
      medicare: mhsPatient.medicare,
      medicarePlan: mhsPatient.medicarePlan,
      medicareNumber: override.insuranceNumber || mhsPatient.medicareNumber,
      insurerName,
    };

    return { resolved, mhsPatient };
  }

  private async upsertRecetarioPatient(resolved: any): Promise<void> {
    const docNum = sanitizeDocumentNumber(resolved.personalData.documentValue);
    if (!docNum) return;

    try {
      await recetarioClient.upsertPatient({
        name: resolved.personalData.firstName || '',
        surname: resolved.personalData.lastName || '',
        documentNumber: docNum,
        gender: mapGender(resolved.personalData.gender),
        birthDate: formatBirthDate(resolved.personalData.birthDate),
        healthInsurance: resolved.insurerName || 'PARTICULAR',
        insuranceNumber: resolved.medicareNumber || undefined,
        email: resolved.contactData.email || undefined,
      });
    } catch {
      // non-fatal
    }
  }

  private async patchAthelasPatientIfChanged(
    patientId: string,
    mhsPatient: any,
    override: RecetarioCreateData['patientData']
  ): Promise<void> {
    if (!override) return;

    const personalDataChanges: Record<string, any> = {};
    if (override.firstName) personalDataChanges.firstName = override.firstName;
    if (override.lastName) personalDataChanges.lastName = override.lastName;
    if (override.documentValue) personalDataChanges.documentValue = override.documentValue;
    if (override.documentType) personalDataChanges.documentType = override.documentType;
    if (override.gender) personalDataChanges.gender = reverseMapGender(override.gender);
    if (override.birthDate) personalDataChanges.birthDate = override.birthDate;

    const contactDataChanges: Record<string, any> = {};
    if (override.email) contactDataChanges.email = override.email;

    const patch: Record<string, any> = {};
    if (Object.keys(personalDataChanges).length > 0) patch.personalData = personalDataChanges;
    if (Object.keys(contactDataChanges).length > 0) patch.contactData = contactDataChanges;
    if (override.insuranceNumber && override.insuranceNumber !== mhsPatient.medicareNumber) patch.medicareNumber = override.insuranceNumber;
    if (override.medicareId !== undefined && override.medicareId !== String(mhsPatient.medicareId || '')) patch.medicareId = override.medicareId || null;

    if (Object.keys(patch).length > 0) {
      await this.app.service('patients').patch(patientId, patch as any, this.internal());
    }
  }

  private async handleRegisterUser(data: RecetarioCreateData, params: any): Promise<RecetarioResult> {
    const effectiveMedicId = await this.resolveEffectiveMedicId(data, params);
    const doctor = await this.getDoctorData(effectiveMedicId);
    const readiness = checkDoctorReadiness(doctor);

    if (!readiness.ready) {
      throw new BadRequest(`Profile incomplete. Missing: ${readiness.missingFields.join(', ')}`);
    }

    const orgSettings = await this.getOrgRecetarioSettings(params);
    if (!orgSettings.healthCenterId) {
      throw new BadRequest('Organization must have a registered health center first');
    }

    const doctorMapped = mapDoctorData(doctor);
    const docNum = sanitizeDocumentNumber(doctor.personalData.documentValue);

    // Check if doctor already exists in Recetario
    let response: any = null;
    if (docNum) {
      const existing = await recetarioClient.getUsersByDocumentNumber(docNum, orgSettings.healthCenterId);
      if (Array.isArray(existing) && existing.length > 0 && existing[0]?.id) {
        response = existing[0];
      }
    }

    if (!response) {
      response = await recetarioClient.createRecetarioUser({
        title: doctorMapped.title,
        firstName: doctorMapped.firstName,
        lastName: doctorMapped.lastName,
        nationalId: doctorMapped.nationalId,
        nationalIdType: doctorMapped.nationalIdType,
        email: doctorMapped.email,
        nationalLicenseNumber: doctorMapped.nationalLicenseNumber,
        stateLicenseNumber: doctorMapped.stateLicenseNumber,
        stateLicenseName: doctorMapped.stateLicenseName,
        specialty: doctorMapped.specialty,
        province: doctorMapped.province,
        healthCenterId: orgSettings.healthCenterId,
      });
    }

    // Store Recetario user ID in md_settings
    if (response.id) {
      const mdSettingsResult = await this.app.service('md-settings').find({
        query: { userId: effectiveMedicId, $limit: 1 },
        paginate: false,
        ...this.internal(),
      } as any);
      const mdRecord = Array.isArray(mdSettingsResult) ? mdSettingsResult[0] : null;
      if (mdRecord?.id) {
        await this.app.service('md-settings').patch(
          mdRecord.id,
          { recetarioUserId: response.id } as any,
          this.internal()
        );
      }

      // Upload signature if available
      if (doctor.mdSettings.signatureImage) {
        try {
          await recetarioClient.updateUserSignature(response.id, doctor.mdSettings.signatureImage);
        } catch {
          // Non-fatal: signature upload failed
        }
      }
    }

    return { success: true, recetarioUserId: response.id };
  }
}
