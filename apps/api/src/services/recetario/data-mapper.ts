import type { QuickLinkPayload, DoctorPayload, PatientPayload } from './recetario-client';

interface DoctorInput {
  personalData: {
    firstName?: string | null;
    lastName?: string | null;
    documentType?: string | null;
    documentValue?: string | null;
  };
  contactData: {
    email?: string | null;
    phoneNumber?: string | null;
  };
  mdSettings: {
    medicalSpecialty?: string | null;
    nationalLicenseNumber?: string | null;
    stateLicense?: string | null;
    stateLicenseNumber?: string | null;
    recetarioTitle?: string | null;
    recetarioProvince?: string | null;
    signatureImage?: string | null;
  };
}

interface PatientInput {
  personalData: {
    firstName?: string | null;
    lastName?: string | null;
    documentType?: string | null;
    documentValue?: string | null;
    gender?: string | null;
    birthDate?: string | Date | null;
  };
  contactData: {
    email?: string | null;
    phoneNumber?: string | null;
  };
  medicare?: string | null;
  medicarePlan?: string | null;
  medicareNumber?: string | null;
  insurerName?: string | null;
}

export function sanitizeDocumentNumber(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[\.\-\s]/g, '');
}

export function mapGender(gender: string | null | undefined): string {
  if (!gender) return 'o';
  switch (gender.toLowerCase()) {
    case 'male':
    case 'masculino':
    case 'm':
      return 'm';
    case 'female':
    case 'femenino':
    case 'f':
      return 'f';
    default:
      return 'o';
  }
}

// Recetario (m|f|o) → Athelas (male|female|other)
export function reverseMapGender(gender: string | null | undefined): string {
  if (!gender) return '';
  switch (gender.toLowerCase()) {
    case 'm': return 'male';
    case 'f': return 'female';
    default:  return 'other';
  }
}

export function formatBirthDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function mapDocumentType(docType: string | null | undefined): string {
  if (!docType) return 'DNI';
  switch (docType.toUpperCase()) {
    case 'DNI':
      return 'DNI';
    case 'CI':
      return 'CI';
    case 'LE':
      return 'LE';
    case 'LC':
      return 'LC';
    case 'PASSPORT':
    case 'PASAPORTE':
      return 'PASSPORT';
    default:
      return 'DNI';
  }
}

export function mapDoctorData(doctor: DoctorInput): QuickLinkPayload['professional'] {
  const { personalData: pd, contactData: cd, mdSettings: md } = doctor;

  return {
    title: md.recetarioTitle || 'Dr',
    firstName: pd.firstName || '',
    lastName: pd.lastName || '',
    nationalId: sanitizeDocumentNumber(pd.documentValue),
    nationalIdType: mapDocumentType(pd.documentType),
    email: cd.email || '',
    nationalLicenseNumber: md.nationalLicenseNumber || '',
    stateLicenseNumber: md.stateLicenseNumber || undefined,
    stateLicenseName: md.stateLicense || undefined,
    specialty: md.medicalSpecialty || '',
    province: md.recetarioProvince || '',
    signatureImage: md.signatureImage || undefined,
  };
}

export function mapPatientData(patient: PatientInput): QuickLinkPayload['patient'] {
  const { personalData: pd, contactData: cd } = patient;

  return {
    firstName: pd.firstName || '',
    lastName: pd.lastName || '',
    nationalId: sanitizeDocumentNumber(pd.documentValue),
    nationalIdType: mapDocumentType(pd.documentType),
    email: cd.email || undefined,
    gender: mapGender(pd.gender),
    birthDate: formatBirthDate(pd.birthDate),
    healthInsuranceName: patient.insurerName || undefined,
    healthInsurancePlan: patient.medicarePlan || undefined,
    healthInsuranceNumber: patient.medicareNumber || patient.medicare || undefined,
  };
}

export function mapDoctorForAPI(doctor: DoctorInput): DoctorPayload {
  const { personalData: pd, contactData: cd, mdSettings: md } = doctor;

  let licenseType = 'nacional';
  let licenseNumber = md.nationalLicenseNumber || '';
  if (!licenseNumber && md.stateLicenseNumber) {
    licenseType = 'provincial';
    licenseNumber = md.stateLicenseNumber;
  }

  return {
    email: cd.email || '',
    name: pd.firstName || '',
    surname: pd.lastName || '',
    licenseType,
    licenseNumber,
    documentNumber: sanitizeDocumentNumber(pd.documentValue),
    province: md.recetarioProvince || '',
    title: md.recetarioTitle || 'Dr',
    specialty: md.medicalSpecialty || '',
    signature: md.signatureImage || undefined,
    profile: {
      legend: licenseNumber,
      phone: (cd.phoneNumber || '').replace(/^tel:/i, ''),
      address: '',
      email: cd.email || '',
    },
  };
}

export function mapPatientForAPI(patient: PatientInput): PatientPayload {
  const { personalData: pd, contactData: cd } = patient;

  return {
    healthInsurance: patient.insurerName || 'PARTICULAR',
    insuranceNumber: patient.medicareNumber || undefined,
    name: pd.firstName || '',
    surname: pd.lastName || '',
    documentNumber: sanitizeDocumentNumber(pd.documentValue),
    email: cd.email || undefined,
    phone: cd.phoneNumber || undefined,
    gender: mapGender(pd.gender),
    birthDate: formatBirthDate(pd.birthDate),
  };
}

export function checkDoctorReadiness(doctor: DoctorInput): { ready: boolean; missingFields: string[] } {
  const missing: string[] = [];
  const { personalData: pd, contactData: cd, mdSettings: md } = doctor;

  if (!pd.firstName) missing.push('personalData.firstName');
  if (!pd.lastName) missing.push('personalData.lastName');
  if (!pd.documentValue) missing.push('personalData.documentValue');
  if (!cd.email) missing.push('contactData.email');
  if (!md.nationalLicenseNumber) missing.push('mdSettings.nationalLicenseNumber');
  if (!md.medicalSpecialty) missing.push('mdSettings.medicalSpecialty');
  if (!md.recetarioTitle) missing.push('mdSettings.recetarioTitle');
  if (!md.recetarioProvince) missing.push('mdSettings.recetarioProvince');

  return {
    ready: missing.length === 0,
    missingFields: missing,
  };
}
