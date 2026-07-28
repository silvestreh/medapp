export const AR_SYSTEMS = {
  DNI: 'http://www.renaper.gob.ar/dni',
  PASSPORT: 'http://www.mininterior.gob.ar/pas',
  REFEPS: 'http://refeps.msal.gob.ar',
  REFES: 'http://refes.msal.gob.ar',
  FEDERADOR: 'https://federador.msal.gob.ar/patient-id',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  LOINC: 'http://loinc.org',
  SNOMED: 'http://snomed.info/sct',
} as const;

export const DOMAIN_SYSTEM = process.env.FHIR_DOMAIN_SYSTEM || 'http://athelas.app/fhir';

// Public REST base of this server. Used for Bundle fullUrls so relative
// references (Patient/<id>) resolve per FHIR bundle-resolution rules.
export const FHIR_BASE_URL = (process.env.FHIR_BASE_URL || 'https://fhir.athelas.app').replace(/\/$/, '');

// IPS "absent or unknown data" code system, used for placeholder resources
// in otherwise-empty $summary sections.
export const IPS_ABSENT_UNKNOWN_SYSTEM = 'http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips';

// Namespace fixed by Composition-ar-ips-core for the custodian identifier:
// the domain registered with the national federator. The value is assigned
// during DNSIS registration.
export const FEDERADOR_URI_SYSTEM = 'http://federador.msal.gob.ar/uri';
export const FEDERADOR_DOMAIN_ID = process.env.FHIR_FEDERADOR_DOMAIN || DOMAIN_SYSTEM;

export const LOINC_CODES = {
  PATIENT_SUMMARY: '60591-5',
  IMMUNIZATIONS: '11369-6',
  CONDITIONS: '11450-4',
  MEDICATIONS: '10160-0',
  ALLERGIES: '48765-2',
} as const;
