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

export const LOINC_CODES = {
  PATIENT_SUMMARY: '60591-5',
  IMMUNIZATIONS: '11369-6',
  CONDITIONS: '11450-4',
  MEDICATIONS: '10160-0',
  ALLERGIES: '48765-2',
} as const;
