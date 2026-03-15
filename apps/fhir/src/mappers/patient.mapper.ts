import type { Patient, Identifier, ContactPoint, Address, Extension } from '@medplum/fhirtypes';
import { AR_SYSTEMS, DOMAIN_SYSTEM } from '../utils/identifiers';

interface PersonalData {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  documentType?: string;
  documentValue: string;
  maritalStatus?: string;
  birthDate?: string;
  gender?: string;
}

interface ContactData {
  streetAddress?: string;
  country?: string;
  city?: string;
  province?: string;
  phoneNumber?: string;
  email?: string;
}

interface InternalPatient {
  id: string;
  deleted: boolean;
  medicare?: string;
  medicareNumber?: string;
  medicarePlan?: string;
  personal_data?: PersonalData[];
  contact_data?: ContactData[];
}

const MARITAL_STATUS_MAP: Record<string, { code: string; display: string }> = {
  single: { code: 'S', display: 'Never Married' },
  married: { code: 'M', display: 'Married' },
  divorced: { code: 'D', display: 'Divorced' },
  widowed: { code: 'W', display: 'Widowed' },
};

const V2_0203 = 'http://terminology.hl7.org/CodeSystem/v2-0203';

function resolveDocumentIdentifier(pd: PersonalData): Identifier {
  const docType = (pd.documentType || '').toUpperCase().trim();

  // DNI — Argentine national ID (RENAPER)
  if (docType === 'DNI' || docType === 'DOCUMENTO NACIONAL DE IDENTIDAD' || (!docType && pd.nationality === 'AR')) {
    return {
      use: 'official',
      system: AR_SYSTEMS.DNI,
      value: pd.documentValue,
    };
  }

  // CI — Cédula de Identidad (used in some provinces and neighboring countries)
  if (docType === 'CI') {
    return {
      use: 'official',
      type: { coding: [{ system: V2_0203, code: 'NI' }], text: 'Cédula de Identidad' },
      value: pd.documentValue,
    };
  }

  // LE — Libreta de Enrolamiento
  if (docType === 'LE') {
    return {
      use: 'official',
      system: AR_SYSTEMS.DNI,
      type: { coding: [{ system: V2_0203, code: 'NI' }], text: 'Libreta de Enrolamiento' },
      value: pd.documentValue,
    };
  }

  // LC — Libreta Cívica
  if (docType === 'LC') {
    return {
      use: 'official',
      system: AR_SYSTEMS.DNI,
      type: { coding: [{ system: V2_0203, code: 'NI' }], text: 'Libreta Cívica' },
      value: pd.documentValue,
    };
  }

  // Passport
  if (docType === 'PASSPORT' || docType === 'PASAPORTE') {
    return {
      use: 'official',
      system: AR_SYSTEMS.PASSPORT,
      type: { coding: [{ system: V2_0203, code: 'PPN' }], text: 'Pasaporte' },
      value: pd.documentValue,
    };
  }

  // Fallback — unknown document type
  return {
    use: 'official',
    type: {
      coding: [{ system: V2_0203, code: 'NI' }],
      text: pd.documentType || 'National ID',
    },
    value: pd.documentValue,
  };
}

function buildIdentifiers(patient: InternalPatient, pd: PersonalData): Identifier[] {
  const identifiers: Identifier[] = [];

  // DocumentoUnico - mandatory
  identifiers.push(resolveDocumentIdentifier(pd));

  // IdentificadorDominio - mandatory
  identifiers.push({
    use: 'usual',
    system: DOMAIN_SYSTEM,
    value: patient.id,
  });

  return identifiers;
}

interface HumanNameWithExtensions {
  use: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  _family?: { extension: Extension[] };
}

function buildName(pd: PersonalData): HumanNameWithExtensions[] {
  const fathersFamily: Extension = {
    url: 'http://hl7.org/fhir/StructureDefinition/humanname-fathers-family',
    valueString: pd.lastName || '',
  };

  return [{
    use: 'official',
    family: pd.lastName || undefined,
    given: pd.firstName ? [pd.firstName] : undefined,
    _family: pd.lastName ? { extension: [fathersFamily] } : undefined,
  }];
}

function buildTelecom(cd: ContactData): ContactPoint[] {
  const telecom: ContactPoint[] = [];
  if (cd.phoneNumber) {
    telecom.push({ system: 'phone', value: cd.phoneNumber, use: 'home' });
  }
  if (cd.email) {
    telecom.push({ system: 'email', value: cd.email, use: 'home' });
  }
  return telecom;
}

function buildAddress(cd: ContactData): Address[] {
  if (!cd.streetAddress && !cd.city && !cd.province && !cd.country) return [];
  return [{
    use: 'home',
    line: cd.streetAddress ? [cd.streetAddress] : undefined,
    city: cd.city || undefined,
    state: cd.province || undefined,
    country: cd.country || undefined,
  }];
}

export function mapPatient(internal: InternalPatient): Patient {
  const pd = internal.personal_data?.[0];
  const cd = internal.contact_data?.[0];

  const patient: Patient = {
    resourceType: 'Patient',
    id: internal.id,
    meta: {
      profile: ['http://fhir.msal.gob.ar/core/StructureDefinition/Patient-ar-core'],
    },
    active: !internal.deleted,
  };

  if (pd) {
    patient.identifier = buildIdentifiers(internal, pd);
    // Cast needed: _family extension is valid FHIR but not in @medplum/fhirtypes
    patient.name = buildName(pd) as Patient['name'];
    patient.gender = (pd.gender as Patient['gender']) || undefined;
    patient.birthDate = pd.birthDate || undefined;

    if (pd.maritalStatus && MARITAL_STATUS_MAP[pd.maritalStatus]) {
      const ms = MARITAL_STATUS_MAP[pd.maritalStatus];
      patient.maritalStatus = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: ms.code,
          display: ms.display,
        }],
      };
    }
  }

  if (cd) {
    patient.telecom = buildTelecom(cd);
    patient.address = buildAddress(cd);
  }

  return patient;
}
