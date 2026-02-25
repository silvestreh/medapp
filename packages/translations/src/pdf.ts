export type PdfLocale = 'es' | 'en';

export interface PdfStrings {
  yes: string;
  no: string;
  patientData: string;
  fullName: string;
  birthDate: string;
  healthInsurance: string;
  periodRange: string;
  periodTo: string;
  fullHistory: string;
  encounters: string;
  studies: string;
  noRecords: string;
  signedBy: string;
  generatedOn: string;
  pageOf: string;
  referringDoctor: string;
  protocol: string;
  ref: string;
  unknown: string;
  filePrefix: string;
  patientFallback: string;
  emailSubjectPrefix: string;
  signingReason: string;
  pdfSentTo: string;
  comments: string;
  conclusion: string;
}

const es: PdfStrings = {
  yes: 'Sí',
  no: 'No',
  patientData: 'Datos del Paciente',
  fullName: 'Nombre completo',
  birthDate: 'Fecha de nacimiento',
  healthInsurance: 'Obra social',
  periodRange: 'Período:',
  periodTo: 'al',
  fullHistory: 'Historial completo',
  encounters: 'Consultas',
  studies: 'Estudios',
  noRecords: 'No se encontraron registros en el rango seleccionado.',
  signedBy: 'Firmado digitalmente por Dr.',
  generatedOn: 'Generado el',
  pageOf: 'de',
  referringDoctor: 'Derivante:',
  protocol: 'Protocolo',
  ref: 'Ref.',
  unknown: 'Desconocido',
  filePrefix: 'historia_clinica',
  patientFallback: 'paciente',
  emailSubjectPrefix: 'Historia Clínica',
  signingReason: 'Historia clínica firmada por Dr.',
  pdfSentTo: 'PDF enviado a',
  comments: 'Comentarios',
  conclusion: 'Conclusión',
};

const en: PdfStrings = {
  yes: 'Yes',
  no: 'No',
  patientData: 'Patient Data',
  fullName: 'Full name',
  birthDate: 'Date of birth',
  healthInsurance: 'Health insurance',
  periodRange: 'Period:',
  periodTo: 'to',
  fullHistory: 'Full history',
  encounters: 'Encounters',
  studies: 'Studies',
  noRecords: 'No records found in the selected range.',
  signedBy: 'Digitally signed by Dr.',
  generatedOn: 'Generated on',
  pageOf: 'of',
  referringDoctor: 'Referring:',
  protocol: 'Protocol',
  ref: 'Ref.',
  unknown: 'Unknown',
  filePrefix: 'medical_history',
  patientFallback: 'patient',
  emailSubjectPrefix: 'Medical History',
  signingReason: 'Medical history signed by Dr.',
  pdfSentTo: 'PDF sent to',
  comments: 'Comments',
  conclusion: 'Conclusion',
};

const pdfTranslations: Record<PdfLocale, PdfStrings> = { es, en };

export function getPdfTranslations(locale?: string): PdfStrings {
  if (locale && locale in pdfTranslations) {
    return pdfTranslations[locale as PdfLocale];
  }
  return pdfTranslations.es;
}
