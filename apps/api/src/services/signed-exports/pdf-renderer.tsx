import React from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
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
  type FormTemplateSchema,
  type CustomFormField,
} from '@athelas/encounter-schemas';
import { getPdfTranslations, translateLabel, getProvinceName } from '@athelas/translations';

export interface PdfDoctorInfo {
  fullName: string;
  title: string;
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

export interface PdfImageAttachment {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface PdfAttachmentMergeInfo {
  encounterId: string;
  encounterDate: string;
  fileName: string;
  buffer: Buffer;
}

export interface PdfEncounter {
  id: string;
  date: string;
  doctorName: string;
  doctorTitle: string;
  data: Record<string, any>;
  imageAttachments?: PdfImageAttachment[];
  pdfAttachmentNames?: string[];
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
  doctorTitle: string;
  referringDoctor: string | null;
  results: PdfStudyResult[];
}

export interface PdfCustomForm {
  formKey: string;
  label: string;
  schema: FormTemplateSchema;
}

export interface PdfStudySignature {
  image: string;
  doctorName: string;
  doctorTitle: string;
  licenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
}

export interface PdfRenderOptions {
  organizationName: string;
  organizationLogoUrl?: string;
  doctor: PdfDoctorInfo;
  patient: PdfPatientInfo;
  encounters: PdfEncounter[];
  studies: PdfStudy[];
  customForms?: PdfCustomForm[];
  studySignature?: PdfStudySignature;
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

export function formatFieldValue(
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

export interface PdfLine {
  kind: 'heading' | 'field';
  label: string;
  value?: string;
  reference?: string;
}

export function extractFormLines(
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

export function formatStudyValue(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'object' && 'label' in value) return value.label || '';
  return String(value);
}

export function resolveStudyReference(
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

export function extractStudyLines(
  schema: StudySchema,
  data: Record<string, any>,
  patientGender?: string,
  locale?: string,
): PdfLine[] {
  const lines: PdfLine[] = [];
  const tl = (label: string) => translateLabel(locale, label);

  for (const field of schema.fields) {
    if (field.type === 'separator') continue;

    if (field.type === 'title') {
      if (field.label) {
        lines.push({ kind: 'heading', label: tl(field.label).replace(/<[^>]*>/g, '') });
      }
      continue;
    }

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

function formatCustomFieldValue(
  field: CustomFormField,
  value: any,
  t: ReturnType<typeof getPdfTranslations>,
  locale?: string,
): string {
  if (value === null || value === undefined || value === '') return '';
  if (value === 'indeterminate') return '';

  switch (field.type) {
  case 'tri-state-checkbox':
    if (value === true || value === 'si' || value === 'on') return t.yes;
    if (value === false || value === 'no' || value === 'off') return t.no;
    return '';
  case 'date':
    try {
      return dayjs(value).format('DD/MM/YYYY');
    } catch {
      return String(value);
    }
  case 'icd10':
    if (Array.isArray(value)) {
      return value
        .map((v: any) => {
          if (!v) return '';
          if (typeof v === 'string') return v;
          return [v.code, v.label].filter(Boolean).join(' ').trim();
        })
        .filter(Boolean)
        .join(', ');
    }
    return String(value);
  case 'select': {
    const options = (field.options ?? []) as (SelectOption | SelectOptionGroup)[];
    for (const opt of options) {
      if ('group' in opt && 'items' in opt) {
        const match = (opt as SelectOptionGroup).items.find((i) => i.value === value);
        if (match) return translateLabel(locale, match.label);
      } else if ((opt as SelectOption).value === value) {
        return translateLabel(locale, (opt as SelectOption).label);
      }
    }
    return String(value);
  }
  default:
    if (Array.isArray(value)) return value.filter(Boolean).join(', ');
    return String(value);
  }
}

export function extractCustomFormLines(
  schema: FormTemplateSchema,
  data: Record<string, any>,
  t: ReturnType<typeof getPdfTranslations>,
  locale?: string,
): PdfLine[] {
  const lines: PdfLine[] = [];
  const tl = (label: string) => translateLabel(locale, label);

  const processFields = (fields: CustomFormField[], values: Record<string, any>) => {
    for (const field of fields) {
      if (field.type === 'separator') continue;

      if (field.type === 'group') {
        if (field.label) lines.push({ kind: 'heading', label: tl(field.label) });
        processFields(field.fields, values);
        continue;
      }

      if (field.type === 'tabs') {
        for (const tab of field.tabs) {
          if (tab.label) lines.push({ kind: 'heading', label: tl(tab.label) });
          processFields(tab.fields, values);
        }
        continue;
      }

      if (!field.name) continue;
      const display = formatCustomFieldValue(field, values?.[field.name], t, locale);
      if (!display) continue;
      lines.push({ kind: 'field', label: tl(field.label || field.name), value: display });
    }
  };

  for (const fs of schema.fieldsets) {
    if (fs.title) lines.push({ kind: 'heading', label: tl(fs.title) });

    if (fs.repeatable) {
      const items = data?.[`repeater_${fs.id}`];
      if (!Array.isArray(items)) continue;
      items.forEach((item: any, idx: number) => {
        const itemLabelTpl = fs.itemLabel || '#{{index}}';
        const itemLabel = tl(itemLabelTpl).replace('{{index}}', String(idx + 1));
        lines.push({ kind: 'heading', label: itemLabel });
        processFields(fs.fields, item || {});
      });
    } else if (fs.tabs) {
      for (const tab of fs.tabs) {
        if (tab.label) lines.push({ kind: 'heading', label: tl(tab.label) });
        processFields(tab.fields, data);
      }
    } else {
      processFields(fs.fields, data);
    }
  }

  return lines;
}

export interface FormSectionData {
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

// --- Timeline entry types ---

interface TimelineEntryBase {
  date: string;
  doctorLabel: string;
}

interface EncounterEntry extends TimelineEntryBase {
  type: 'encounter';
  sections: FormSectionData[];
}

interface StudyEntry extends TimelineEntryBase {
  type: 'study';
  protocol: number;
  referringDoctor: string | null;
  resultSections: FormSectionData[];
  hasAnyReference: boolean;
}

interface ImageAttachmentEntry extends TimelineEntryBase {
  type: 'image-attachment';
  attachment: PdfImageAttachment;
}

interface PdfAttachmentEntry extends TimelineEntryBase {
  type: 'pdf-attachment';
  fileName: string;
}

type TimelineEntry = EncounterEntry | StudyEntry | ImageAttachmentEntry | PdfAttachmentEntry;

const TIMELINE_COLORS: Record<TimelineEntry['type'], { dot: string; bg: string; text: string }> = {
  encounter:          { dot: '#2563eb', bg: '#eff6ff', text: '#1e40af' },
  study:              { dot: '#16a34a', bg: '#f0fdf4', text: '#166534' },
  'image-attachment': { dot: '#d97706', bg: '#fffbeb', text: '#92400e' },
  'pdf-attachment':   { dot: '#d97706', bg: '#fffbeb', text: '#92400e' },
};

export async function renderMedicalHistoryPdf(options: PdfRenderOptions): Promise<Buffer> {
  const { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } = await loadReactPdf();

  const t = getPdfTranslations(options.locale);

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontSize: 10,
      fontFamily: 'Helvetica',
      color: '#111827',
    },
    header: {
      marginBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: '#2563eb',
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    orgLogo: {
      width: 48,
      height: 48,
      marginRight: 12,
      objectFit: 'contain',
    },
    orgName: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: '#2563eb',
      marginBottom: 4,
    },
    doctorInfo: {
      fontSize: 9,
      color: '#374151',
      lineHeight: 1.4,
    },
    patientBlock: {
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
      color: '#111827',
    },
    patientValue: {
      flex: 1,
      color: '#111827',
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
    dateRange: {
      fontSize: 10,
      color: '#6b7280',
      marginBottom: 16,
      fontStyle: 'italic',
    },
    // --- Timeline styles ---
    timelineRow: {
      flexDirection: 'row',
    },
    timelineGutter: {
      width: 20,
      alignItems: 'center',
    },
    timelineConnector: {
      width: 2,
      backgroundColor: '#d1d5db',
    },
    timelineContent: {
      flex: 1,
      paddingLeft: 10,
    },
    entryHeader: {
      padding: 6,
      borderRadius: 3,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    entryDateLabel: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    entryDate: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 9,
    },
    entryTypeLabel: {
      fontSize: 7,
      fontFamily: 'Helvetica-Bold',
      marginLeft: 6,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 2,
      color: '#ffffff',
    },
    entryDoctor: {
      fontSize: 8,
      color: '#4b5563',
    },
    // --- Shared content styles ---
    formSection: {
      paddingBottom: 4,
    },
    formTitle: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 9,
      color: '#374151',
      marginBottom: 3,
    },
    fieldRow: {
      flexDirection: 'row',
      marginBottom: 2,
      paddingLeft: 4,
    },
    fieldLabel: {
      fontFamily: 'Helvetica-Bold',
      flex: 1,
      color: '#374151',
      fontSize: 9,
    },
    fieldValue: {
      flex: 1,
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
    },
    fieldReference: {
      width: 80,
      fontSize: 8,
      color: '#6b7280',
      textAlign: 'right',
    },
    // --- Attachment styles ---
    attachmentImage: {
      maxWidth: '100%',
      maxHeight: 400,
      objectFit: 'contain' as any,
      marginBottom: 4,
    },
    attachmentFileName: {
      fontSize: 8,
      color: '#9ca3af',
    },
    pdfAttachmentNote: {
      fontSize: 8,
      color: '#6b7280',
      fontStyle: 'italic',
      marginTop: 2,
    },
    // --- Footer / signature ---
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
    studySignatureBlock: {
      marginTop: 32,
      alignItems: 'flex-end',
    },
    studySignatureImage: {
      width: 110,
      height: 45,
      objectFit: 'contain',
      marginBottom: 2,
    },
    studySignatureName: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      textAlign: 'right',
    },
    studySignatureLicense: {
      fontSize: 8,
      color: '#4b5563',
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

  // --- Helper components ---

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

  function typeLabel(entry: TimelineEntry): string {
    switch (entry.type) {
    case 'encounter': return t.encounter;
    case 'study': return t.study;
    case 'image-attachment':
    case 'pdf-attachment': return t.attachmentLabel;
    }
  }

  function EntryContent({ entry }: { entry: TimelineEntry }) {
    switch (entry.type) {
    case 'encounter':
      return (
        <>
          {entry.sections.map((section, i) => (
            <View key={i} style={styles.formSection}>
              <Text style={styles.formTitle}>{section.label}</Text>
              <RenderedLines lines={section.lines} />
            </View>
          ))}
        </>
      );
    case 'study':
      return (
        <>
          {entry.resultSections.map((section, i) => (
            <View key={i} style={styles.formSection}>
              <Text style={styles.formTitle}>{section.label}</Text>
              <RenderedLines lines={section.lines} showReference={entry.hasAnyReference} />
            </View>
          ))}
        </>
      );
    case 'image-attachment':
      return (
        <View wrap={false}>
          <Image
            src={{ data: entry.attachment.buffer, format: entry.attachment.mimeType === 'image/jpeg' ? 'jpg' : 'png' }}
            style={styles.attachmentImage}
          />
          <Text style={styles.attachmentFileName}>{entry.attachment.fileName}</Text>
        </View>
      );
    case 'pdf-attachment':
      return (
        <View>
          <Text style={{ fontSize: 9, color: '#1a1a1a' }}>{entry.fileName}</Text>
          <Text style={styles.pdfAttachmentNote}>{t.seeAppendedPages}</Text>
        </View>
      );
    }
  }

  // --- Build chronological timeline ---

  const { organizationName, doctor, patient, encounters, studies, startDate, endDate, isSigned } = options;

  const timelineEntries: TimelineEntry[] = [];

  const customFormByKey = new Map(
    (options.customForms ?? []).map((cf) => [cf.formKey, cf]),
  );

  for (const enc of encounters) {
    const encounterData = typeof enc.data === 'string' ? JSON.parse(enc.data) : enc.data;
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

    for (const [formKey, entry] of Object.entries(encounterData || {})) {
      if (encounterForms[formKey]) continue;
      const customForm = customFormByKey.get(formKey);
      if (!customForm) continue;
      const values = (entry as any)?.values ?? {};
      const lines = extractCustomFormLines(customForm.schema, values, t, options.locale);
      if (lines.length === 0) continue;
      sections.push({
        label: translateLabel(options.locale, customForm.label || customForm.schema.label),
        lines,
      });
    }

    const doctorLabel = `${enc.doctorTitle} ${enc.doctorName}`;

    if (sections.length > 0) {
      timelineEntries.push({ type: 'encounter', date: enc.date, doctorLabel, sections });
    }

    for (const img of enc.imageAttachments || []) {
      timelineEntries.push({ type: 'image-attachment', date: enc.date, doctorLabel, attachment: img });
    }

    for (const name of enc.pdfAttachmentNames || []) {
      timelineEntries.push({ type: 'pdf-attachment', date: enc.date, doctorLabel, fileName: name });
    }
  }

  for (const study of studies) {
    const resultSections: FormSectionData[] = [];
    for (const result of study.results) {
      const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      const schema = studySchemas[result.type];

      if (schema) {
        const lines = extractStudyLines(schema, data, options.patientGender, options.locale);
        if (data.comments) lines.push({ kind: 'field', label: t.comments, value: String(data.comments) });
        if (data.conclusion) lines.push({ kind: 'field', label: t.conclusion, value: String(data.conclusion) });
        if (lines.length === 0) continue;
        resultSections.push({ label: translateLabel(options.locale, schema.label), lines });
      } else {
        const customForm = customFormByKey.get(result.type);
        if (!customForm) continue;
        const lines = extractCustomFormLines(customForm.schema, data, t, options.locale);
        if (lines.length === 0) continue;
        resultSections.push({
          label: translateLabel(options.locale, customForm.label || customForm.schema.label),
          lines,
        });
      }
    }

    if (resultSections.length === 0) continue;

    const doctorLabel = study.referringDoctor
      ? `${t.referringDoctor} ${study.referringDoctor}`
      : `${study.doctorTitle} ${study.doctorName}`;

    const hasAnyReference = resultSections.some((s) => s.lines.some((l) => l.reference));

    timelineEntries.push({
      type: 'study',
      date: study.date,
      doctorLabel,
      protocol: study.protocol,
      referringDoctor: study.referringDoctor,
      resultSections,
      hasAnyReference,
    });
  }

  // Sort chronologically (stable sort preserves encounter→attachment order for same date)
  timelineEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const hasEntries = timelineEntries.length > 0;

  const dateRangeText = startDate && endDate
    ? `${t.periodRange} ${dayjs(startDate).format('DD/MM/YYYY')} ${t.periodTo} ${dayjs(endDate).format('DD/MM/YYYY')}`
    : t.fullHistory;

  const licenseLines: string[] = [];
  if (doctor.specialty) licenseLines.push(doctor.specialty);
  if (doctor.nationalLicenseNumber) licenseLines.push(`M.N. ${doctor.nationalLicenseNumber}`);
  if (doctor.stateLicense && doctor.stateLicenseNumber) {
    licenseLines.push(`M.P. (${getProvinceName(doctor.stateLicense, options.locale)}) ${doctor.stateLicenseNumber}`);
  }

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {options.organizationLogoUrl && (
            <Image style={styles.orgLogo} src={options.organizationLogoUrl} />
          )}
          <View>
            <Text style={styles.orgName}>{organizationName}</Text>
            <Text style={styles.doctorInfo}>
              {doctor.title} {doctor.fullName}
              {licenseLines.length > 0 ? ` — ${licenseLines.join(' | ')}` : ''}
            </Text>
          </View>
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
              <Text style={styles.patientValue}>{dayjs.utc(patient.birthDate).format('DD/MM/YYYY')}</Text>
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

        {hasEntries && timelineEntries.map((entry, i) => {
          const colors = TIMELINE_COLORS[entry.type];
          const isFirst = i === 0;
          const isLast = i === timelineEntries.length - 1;

          return (
            <View key={i} style={styles.timelineRow}>
              {/* Timeline gutter: connector line + dot */}
              <View style={styles.timelineGutter}>
                {!isFirst && (
                  <View style={[styles.timelineConnector, { height: 6 }]} />
                )}
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.dot,
                }} />
                {!isLast && (
                  <View style={[styles.timelineConnector, { flex: 1 }]} />
                )}
              </View>

              {/* Entry content */}
              <View style={[styles.timelineContent, { paddingBottom: isLast ? 0 : 14 }]}>
                {/* Entry header */}
                <View style={[styles.entryHeader, { backgroundColor: colors.bg }]} wrap={false}>
                  <View style={styles.entryDateLabel}>
                    <Text style={[styles.entryDate, { color: colors.text }]}>
                      {dayjs(entry.date).format('DD/MM/YYYY')}
                      {entry.type === 'study' ? ` — ${t.protocol} #${entry.protocol}` : ''}
                    </Text>
                    <Text style={[styles.entryTypeLabel, { backgroundColor: colors.dot }]}>
                      {typeLabel(entry)}
                    </Text>
                  </View>
                  <Text style={styles.entryDoctor}>{entry.doctorLabel}</Text>
                </View>

                {/* Entry body */}
                <EntryContent entry={entry} />
              </View>
            </View>
          );
        })}

        {!hasEntries && (
          <Text style={styles.emptyNote}>{t.noRecords}</Text>
        )}

        {options.studySignature && (
          <View style={styles.studySignatureBlock} wrap={false}>
            <Image
              src={`data:image/png;base64,${options.studySignature.image}`}
              style={styles.studySignatureImage}
            />
            <Text style={styles.studySignatureName}>
              {options.studySignature.doctorTitle} {options.studySignature.doctorName}
            </Text>
            {options.studySignature.licenseNumber && (
              <Text style={styles.studySignatureLicense}>M.N. {options.studySignature.licenseNumber}</Text>
            )}
            {options.studySignature.stateLicense && options.studySignature.stateLicenseNumber && (
              <Text style={styles.studySignatureLicense}>
                M.P. ({getProvinceName(options.studySignature.stateLicense, options.locale)}) {options.studySignature.stateLicenseNumber}
              </Text>
            )}
          </View>
        )}

        {isSigned && (
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureText}>
              {t.signedBy} {doctor.fullName}
            </Text>
            {doctor.nationalLicenseNumber && (
              <Text style={styles.signatureText}>M.N. {doctor.nationalLicenseNumber}</Text>
            )}
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
