import React from 'react';
import dayjs from 'dayjs';
import {
  encounterForms,
  FORM_KEY_ORDER,
  studySchemas,
  type EncounterField,
  type EncounterSchema,
  type StudySchema,
  type StudyField,
  type SelectOption,
  type SelectOptionGroup,
} from '@medapp/encounter-schemas';
import { getPdfTranslations, translateLabel } from '@medapp/translations';

export interface PdfDoctorInfo {
  fullName: string;
  specialty: string | null;
  nationalLicenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
}

export interface PdfPatientInfo {
  fullName: string;
  documentType: string | null;
  documentValue: string | null;
  birthDate: string | null;
  medicare: string | null;
  medicarePlan: string | null;
}

export interface PdfEncounter {
  id: string;
  date: string;
  doctorName: string;
  data: Record<string, any>;
}

export interface PdfStudyResult {
  type: string;
  data: Record<string, any>;
}

export interface PdfStudy {
  id: string;
  date: string;
  protocol: number;
  doctorName: string;
  referringDoctor: string | null;
  results: PdfStudyResult[];
}

export interface PdfRenderOptions {
  organizationName: string;
  doctor: PdfDoctorInfo;
  patient: PdfPatientInfo;
  encounters: PdfEncounter[];
  studies: PdfStudy[];
  startDate?: string;
  endDate?: string;
  isSigned: boolean;
  locale?: string;
  patientGender?: string;
}

function resolveSelectLabel(field: EncounterField, rawValue: string): string {
  if (field.type !== 'select' || !('options' in field) || !field.options) {
    return rawValue;
  }

  const options = field.options as (SelectOption | SelectOptionGroup)[];
  for (const opt of options) {
    if ('group' in opt && 'items' in opt) {
      const match = (opt as SelectOptionGroup).items.find(
        (item) => item.value === rawValue
      );
      if (match) return match.label;
    } else {
      const flat = opt as SelectOption;
      if (flat.value === rawValue) return flat.label;
    }
  }

  return rawValue;
}

function formatTriState(val: any, t: ReturnType<typeof getPdfTranslations>): string {
  if (val === true || val === 'si' || val === 'on') return t.yes;
  if (val === false || val === 'no' || val === 'off') return t.no;
  return '';
}

function formatFieldValue(
  value: any,
  t: ReturnType<typeof getPdfTranslations>,
  field?: EncounterField,
  locale?: string,
): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return formatTriState(value, t);
  if (value === 'indeterminate') return '';
  if (value instanceof Date) return dayjs(value).format('DD/MM/YYYY');
  if (Array.isArray(value)) {
    return value.filter(v => v && String(v).trim()).join(', ');
  }

  const str = String(value);
  if (field && field.type === 'select') {
    const label = resolveSelectLabel(field, str);
    return translateLabel(locale, label);
  }
  return str;
}

interface PdfLine {
  kind: 'heading' | 'field';
  label: string;
  value?: string;
  reference?: string;
}

function extractFormLines(
  schema: EncounterSchema,
  formValues: Record<string, any>,
  t: ReturnType<typeof getPdfTranslations>,
  locale?: string,
): PdfLine[] {
  const lines: PdfLine[] = [];
  const tl = (label: string) => translateLabel(locale, label);

  const processFields = (fields: EncounterField[], values: Record<string, any>) => {
    for (const field of fields) {
      if (field.type === 'title' || field.type === 'separator') continue;

      if (field.type === 'group' && field.fields) {
        if (field.label) {
          lines.push({ kind: 'heading', label: tl(field.label) });
        }
        processFields(field.fields, values);
        continue;
      }

      if (field.type === 'tabs' && field.tabs) {
        for (const tab of field.tabs) {
          lines.push({ kind: 'heading', label: tl(tab.label) });
          processFields(tab.fields, values);
        }
        continue;
      }

      if (field.type === 'array' && field.name && field.itemFields) {
        const items = values[field.name];
        if (!Array.isArray(items) || items.length === 0) continue;

        items.forEach((item: any, idx: number) => {
          const rawItemLabel = field.itemLabel || '#{{index}}';
          const itemLabel = tl(rawItemLabel).replace('{{index}}', String(idx + 1));

          lines.push({ kind: 'heading', label: itemLabel });

          for (const itemField of field.itemFields!) {
            if (itemField.type === 'title' || itemField.type === 'separator') continue;
            const val = item[itemField.name || ''];
            const display = formatFieldValue(val, t, itemField, locale);
            if (!display) continue;
            lines.push({ kind: 'field', label: tl(itemField.label || itemField.name || ''), value: display });
          }
        });
        continue;
      }

      if (!field.name) continue;
      const val = values[field.name];
      const display = formatFieldValue(val, t, field, locale);
      if (!display) continue;

      lines.push({ kind: 'field', label: tl(field.label || field.name), value: display });
    }
  };

  processFields(schema.fields, formValues);
  return lines;
}

function formatStudyValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object' && 'label' in value) return value.label || '';
  return String(value);
}

function resolveStudyReference(
  field: StudyField,
  patientGender?: string,
): string | undefined {
  const ref = field.reference;
  if (!ref) return undefined;

  if (typeof ref === 'string') {
    return ref === '–' ? undefined : ref;
  }

  const genderKey = patientGender || 'male';
  const val = (ref as Record<string, string | undefined>)[genderKey];
  if (val && val !== '–') return val;

  const fallback = ref.o || ref.other;
  if (fallback && fallback !== '–') return fallback;

  return undefined;
}

function extractStudyLines(
  schema: StudySchema,
  data: Record<string, any>,
  patientGender?: string,
  locale?: string,
): PdfLine[] {
  const lines: PdfLine[] = [];
  const tl = (label: string) => translateLabel(locale, label);

  for (const field of schema.fields) {
    if (field.type === 'title' || field.type === 'separator') continue;

    if (field.type === 'title-input') {
      if (field.label) {
        lines.push({ kind: 'heading', label: tl(field.label).replace(/<[^>]*>/g, '') });
      }
      if (field.name) {
        const val = formatStudyValue(data[field.name]);
        if (val) {
          const reference = resolveStudyReference(field, patientGender);
          lines.push({
            kind: 'field',
            label: tl(field.label || field.name).replace(/<[^>]*>/g, ''),
            value: `${val}${field.unit ? ` ${field.unit}` : ''}`,
            reference,
          });
        }
      }
      continue;
    }

    if (!field.name) continue;
    const val = formatStudyValue(data[field.name]);
    if (!val) continue;

    const label = tl(field.label || field.name).replace(/<[^>]*>/g, '');
    const reference = resolveStudyReference(field, patientGender);
    lines.push({ kind: 'field', label, value: val, reference });
  }

  return lines;
}

interface FormSectionData {
  label: string;
  lines: PdfLine[];
}

// Dynamic import to avoid CJS/ESM incompatibility — @react-pdf/renderer is ESM-only
let _reactPdf: typeof import('@react-pdf/renderer') | null = null;
async function loadReactPdf() {
  if (!_reactPdf) {
    _reactPdf = await (Function('return import("@react-pdf/renderer")')() as Promise<typeof import('@react-pdf/renderer')>);
  }
  return _reactPdf;
}

export async function renderMedicalHistoryPdf(options: PdfRenderOptions): Promise<Buffer> {
  const { Document, Page, Text, View, StyleSheet, renderToBuffer } = await loadReactPdf();

  const t = getPdfTranslations(options.locale);

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 10,
      fontFamily: 'Helvetica',
      color: '#1a1a1a',
    },
    header: {
      marginBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: '#2563eb',
      paddingBottom: 12,
    },
    orgName: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: '#2563eb',
      marginBottom: 4,
    },
    doctorInfo: {
      fontSize: 9,
      color: '#4b5563',
      lineHeight: 1.4,
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: '#2563eb',
      marginTop: 16,
      marginBottom: 8,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    patientBlock: {
      backgroundColor: '#f9fafb',
      padding: 10,
      borderRadius: 4,
      marginBottom: 12,
    },
    patientRow: {
      flexDirection: 'row',
      marginBottom: 2,
    },
    patientLabel: {
      fontFamily: 'Helvetica-Bold',
      width: 120,
      color: '#374151',
    },
    patientValue: {
      flex: 1,
      color: '#1a1a1a',
    },
    dateRange: {
      fontSize: 10,
      color: '#6b7280',
      marginBottom: 12,
      fontStyle: 'italic',
    },
    encounterCard: {
      marginBottom: 14,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      borderRadius: 4,
      overflow: 'hidden',
    },
    encounterHeader: {
      backgroundColor: '#eff6ff',
      padding: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    encounterDate: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 10,
      color: '#1e40af',
    },
    encounterDoctor: {
      fontSize: 9,
      color: '#4b5563',
    },
    formSection: {
      padding: 8,
      borderTopWidth: 1,
      borderTopColor: '#f3f4f6',
    },
    formTitle: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 10,
      color: '#374151',
      marginBottom: 4,
    },
    fieldRow: {
      flexDirection: 'row',
      marginBottom: 2,
      paddingLeft: 8,
    },
    fieldLabel: {
      fontFamily: 'Helvetica-Bold',
      width: 140,
      color: '#6b7280',
      fontSize: 9,
    },
    fieldValue: {
      flex: 1,
      fontSize: 9,
      color: '#1a1a1a',
    },
    fieldReference: {
      width: 80,
      fontSize: 8,
      color: '#9ca3af',
      textAlign: 'right',
    },
    signatureBlock: {
      marginTop: 30,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#d1d5db',
      alignItems: 'flex-end',
    },
    signatureText: {
      fontSize: 9,
      color: '#6b7280',
      textAlign: 'right',
    },
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 40,
      right: 40,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 8,
      color: '#9ca3af',
    },
    emptyNote: {
      fontSize: 9,
      color: '#9ca3af',
      fontStyle: 'italic',
      paddingLeft: 8,
    },
  });

  function RenderedLines({ lines, showReference }: { lines: PdfLine[]; showReference?: boolean }) {
    return (
      <>
        {lines.map((line, i) => {
          if (line.kind === 'heading') {
            return (
              <Text key={i} style={[styles.formTitle, { fontSize: 9, marginTop: 4 }]}>{line.label}</Text>
            );
          }
          return (
            <View key={i} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{line.label}:</Text>
              <Text style={styles.fieldValue}>{line.value}</Text>
              {showReference && (
                <Text style={styles.fieldReference}>{line.reference || ''}</Text>
              )}
            </View>
          );
        })}
      </>
    );
  }

  function EncounterBlock({ encounter }: { encounter: PdfEncounter }) {
    const encounterData = typeof encounter.data === 'string'
      ? JSON.parse(encounter.data)
      : encounter.data;

    const sections: FormSectionData[] = [];

    for (const formKey of FORM_KEY_ORDER) {
      const formData = encounterData[formKey];
      if (!formData) continue;

      const formDef = encounterForms[formKey];
      if (!formDef) continue;

      const formValues = formDef.adapter.fromLegacy(formData);
      const lines = extractFormLines(formDef.schema, formValues, t, options.locale);
      if (lines.length === 0) continue;

      sections.push({ label: translateLabel(options.locale, formDef.schema.label), lines });
    }

    if (sections.length === 0) return null;

    return (
      <View style={styles.encounterCard} wrap={false}>
        <View style={styles.encounterHeader}>
          <Text style={styles.encounterDate}>
            {dayjs(encounter.date).format('DD/MM/YYYY')}
          </Text>
          <Text style={styles.encounterDoctor}>Dr. {encounter.doctorName}</Text>
        </View>
        {sections.map((section, i) => (
          <View key={i} style={styles.formSection}>
            <Text style={styles.formTitle}>{section.label}</Text>
            <RenderedLines lines={section.lines} />
          </View>
        ))}
      </View>
    );
  }

  function StudyBlock({ study }: { study: PdfStudy }) {
    const resultSections: FormSectionData[] = [];

    for (const result of study.results) {
      const schema = studySchemas[result.type];
      if (!schema) continue;

      const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      const lines = extractStudyLines(schema, data, options.patientGender, options.locale);
      if (lines.length === 0) continue;

      resultSections.push({ label: translateLabel(options.locale, schema.label), lines });
    }

    if (resultSections.length === 0) return null;

    const doctorLine = study.referringDoctor
      ? `${t.referringDoctor} ${study.referringDoctor}`
      : `Dr. ${study.doctorName}`;

    const hasAnyReference = resultSections.some((s) =>
      s.lines.some((l) => l.reference)
    );

    return (
      <View style={styles.encounterCard} wrap={false}>
        <View style={[styles.encounterHeader, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.encounterDate, { color: '#166534' }]}>
            {dayjs(study.date).format('DD/MM/YYYY')} — {t.protocol} #{study.protocol}
          </Text>
          <Text style={styles.encounterDoctor}>{doctorLine}</Text>
        </View>
        {resultSections.map((section, i) => (
          <View key={i} style={styles.formSection}>
            <Text style={styles.formTitle}>{section.label}</Text>
            <RenderedLines lines={section.lines} showReference={hasAnyReference} />
          </View>
        ))}
      </View>
    );
  }

  const { organizationName, doctor, patient, encounters, studies, startDate, endDate, isSigned } = options;

  const hasEncounters = encounters.length > 0;
  const hasStudies = studies.length > 0;

  const dateRangeText = startDate && endDate
    ? `${t.periodRange} ${dayjs(startDate).format('DD/MM/YYYY')} ${t.periodTo} ${dayjs(endDate).format('DD/MM/YYYY')}`
    : t.fullHistory;

  const licenseLines: string[] = [];
  if (doctor.specialty) licenseLines.push(doctor.specialty);
  if (doctor.nationalLicenseNumber) licenseLines.push(`M.N. ${doctor.nationalLicenseNumber}`);
  if (doctor.stateLicense && doctor.stateLicenseNumber) {
    licenseLines.push(`${doctor.stateLicense} ${doctor.stateLicenseNumber}`);
  }

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.orgName}>{organizationName}</Text>
          <Text style={styles.doctorInfo}>
            Dr. {doctor.fullName}
            {licenseLines.length > 0 ? ` — ${licenseLines.join(' | ')}` : ''}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{t.patientData}</Text>
        <View style={styles.patientBlock}>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>{t.fullName}:</Text>
            <Text style={styles.patientValue}>{patient.fullName}</Text>
          </View>
          {patient.documentType && patient.documentValue && (
            <View style={styles.patientRow}>
              <Text style={styles.patientLabel}>{patient.documentType}:</Text>
              <Text style={styles.patientValue}>{patient.documentValue}</Text>
            </View>
          )}
          {patient.birthDate && (
            <View style={styles.patientRow}>
              <Text style={styles.patientLabel}>{t.birthDate}:</Text>
              <Text style={styles.patientValue}>{dayjs(patient.birthDate).format('DD/MM/YYYY')}</Text>
            </View>
          )}
          {patient.medicare && (
            <View style={styles.patientRow}>
              <Text style={styles.patientLabel}>{t.healthInsurance}:</Text>
              <Text style={styles.patientValue}>
                {patient.medicare}
                {patient.medicarePlan ? ` — ${patient.medicarePlan}` : ''}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.dateRange}>{dateRangeText}</Text>

        {hasEncounters && (
          <>
            <Text style={styles.sectionTitle}>{t.encounters}</Text>
            {encounters.map((encounter) => (
              <EncounterBlock key={encounter.id} encounter={encounter} />
            ))}
          </>
        )}

        {hasStudies && (
          <>
            <Text style={styles.sectionTitle}>{t.studies}</Text>
            {studies.map((study) => (
              <StudyBlock key={study.id} study={study} />
            ))}
          </>
        )}

        {!hasEncounters && !hasStudies && (
          <Text style={styles.emptyNote}>{t.noRecords}</Text>
        )}

        {isSigned && (
          <View style={styles.signatureBlock}>
            <>
              <Text style={styles.signatureText}>
                {t.signedBy} {doctor.fullName}
              </Text>
              {doctor.nationalLicenseNumber && (
                <Text style={styles.signatureText}>M.N. {doctor.nationalLicenseNumber}</Text>
              )}
            </>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>{t.generatedOn} {dayjs().format('DD/MM/YYYY HH:mm')}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} ${t.pageOf} ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
