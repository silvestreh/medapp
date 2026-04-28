import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import {
  encounterForms,
  FORM_KEY_ORDER,
  studySchemas,
} from '@athelas/encounter-schemas';
import { getPdfTranslations, translateLabel, getProvinceName } from '@athelas/translations';
import {
  type PdfRenderOptions,
  type PdfLine,
  type FormSectionData,
  extractFormLines,
  extractStudyLines,
  extractCustomFormLines,
} from './pdf-renderer';

function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const COLORS = {
  encounter:         { dot: '#2563eb', bg: '#eff6ff', text: '#1e40af' },
  study:             { dot: '#16a34a', bg: '#f0fdf4', text: '#166534' },
  attachment:        { dot: '#d97706', bg: '#fffbeb', text: '#92400e' },
};

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #111827;
    padding: 20mm;
  }
  @media print {
    body { padding: 0; }
    @page { margin: 15mm; }
    .entry { break-inside: avoid; }
    .entry-header { break-inside: avoid; break-after: avoid; }
  }

  /* Header */
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 2px solid #2563eb;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .org-logo { width: 48px; height: 48px; object-fit: contain; }
  .org-name { font-size: 16pt; font-weight: bold; color: #2563eb; margin-bottom: 4px; }
  .doctor-info { font-size: 9pt; color: #374151; }

  /* Patient block */
  .section-title { font-size: 9pt; font-weight: bold; color: #374151; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  .patient-block { padding: 10px; margin-bottom: 16px; margin-top: 16px; border-left: 2px solid #d1d5db; }
  .patient-row { display: flex; margin-bottom: 3px; font-size: 9.5pt; }
  .patient-label { font-weight: bold; width: 140px; flex-shrink: 0; color: #111827; }
  .patient-value { color: #111827; }

  /* Date range */
  .date-range { font-size: 9pt; color: #6b7280; margin-bottom: 16px; }

  /* Timeline */
  .timeline { display: flex; flex-direction: column; }
  .entry { display: flex; flex-direction: row; gap: 12px; }
  .entry-gutter { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
  .entry-gutter-line { width: 2px; background: #d1d5db; flex-shrink: 0; }
  .entry-gutter-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .entry-main { flex: 1; padding-bottom: 14px; }
  .entry-main.last { padding-bottom: 0; }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    border-radius: 4px;
    margin-bottom: 0;
  }
  .entry-date-row { display: flex; align-items: center; gap: 8px; }
  .entry-date { font-size: 9.5pt; font-weight: bold; margin-top: 1px; }
  .entry-badge {
    font-size: 7.5pt;
    font-weight: bold;
    line-height: 10pt;
    color: #fff;
    padding: 3px 6px 1px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .entry-doctor { font-size: 8.5pt; color: #374151; margin-top: 2px; }
  .entry-body { padding: 8px 0 0 0; }

  /* Form sections */
  .form-section { margin-bottom: 8px; }
  .form-title { font-size: 8.5pt; font-weight: bold; color: #374151; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
  .field-heading { font-size: 8pt; font-style: italic; color: #6b7280; margin: 4px 0 2px; }
  .field-row { display: flex; font-size: 9pt; margin-bottom: 2px; }
  .field-label { width: 180px; flex-shrink: 0; color: #374151; }
  .field-value { flex: 1; color: #111827; font-weight: 600; }
  .field-reference { width: 120px; flex-shrink: 0; color: #6b7280; font-size: 8pt; text-align: right; }

  /* Attachments */
  .attachment-image { max-width: 100%; height: auto; margin-bottom: 4px; }
  .attachment-filename { font-size: 8pt; color: #6b7280; font-style: italic; }
  .attachment-note { font-size: 8pt; color: #9ca3af; font-style: italic; }

  /* Empty state */
  .empty-note { font-size: 9pt; color: #9ca3af; font-style: italic; }

  /* Signature */
  .signature-block { margin-top: 30px; padding-top: 12px; border-top: 1px solid #d1d5db; text-align: right; }
  .signature-text { font-size: 9pt; color: #6b7280; }

  /* Study signature stamp */
  .study-signature-block {
    margin-top: 32px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .study-signature-image { max-width: 120px; max-height: 50px; object-fit: contain; margin-bottom: 2px; }
  .study-signature-name { font-size: 8pt; font-weight: bold; color: #111827; }
  .study-signature-license { font-size: 8pt; color: #4b5563; }

  /* Footer */
  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 8pt; color: #9ca3af; }
`;

function renderLines(lines: PdfLine[], showReference: boolean): string {
  return lines.map(line => {
    if (line.kind === 'heading') {
      return `<div class="field-heading">${esc(line.label)}</div>`;
    }
    return `
      <div class="field-row">
        <span class="field-label">${esc(line.label)}:</span>
        <span class="field-value">${esc(line.value)}</span>
        ${showReference ? `<span class="field-reference">${esc(line.reference)}</span>` : ''}
      </div>`;
  }).join('');
}

function renderSections(sections: FormSectionData[], showReference = false): string {
  return sections.map(section => `
    <div class="form-section">
      <div class="form-title">${esc(section.label)}</div>
      ${renderLines(section.lines, showReference)}
    </div>`).join('');
}

export function renderMedicalHistoryHtml(options: PdfRenderOptions): string {
  const { organizationName, organizationLogoUrl, doctor, patient, encounters, studies, startDate, endDate, isSigned } = options;
  const t = getPdfTranslations(options.locale);
  const tl = (label: string) => translateLabel(options.locale, label);

  // --- Build timeline entries (mirrors signed-exports.class.ts logic) ---

  interface TimelineEntry {
    type: 'encounter' | 'study' | 'image-attachment' | 'pdf-attachment';
    date: string;
    doctorLabel: string;
    sections?: FormSectionData[];
    resultSections?: FormSectionData[];
    hasAnyReference?: boolean;
    protocol?: number;
    imageBuffer?: Buffer;
    imageMime?: string;
    imageFileName?: string;
    pdfFileName?: string;
  }

  const entries: TimelineEntry[] = [];

  const customFormByKey = new Map(
    (options.customForms ?? []).map(cf => [cf.formKey, cf])
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
      sections.push({ label: tl(formDef.schema.label), lines });
    }

    for (const [formKey, entry] of Object.entries(encounterData || {})) {
      if (encounterForms[formKey]) continue;
      const customForm = customFormByKey.get(formKey);
      if (!customForm) continue;
      const values = (entry as any)?.values ?? {};
      const lines = extractCustomFormLines(customForm.schema, values, t, options.locale);
      if (lines.length === 0) continue;
      sections.push({ label: tl(customForm.label || customForm.schema.label), lines });
    }

    const doctorLabel = `${enc.doctorTitle} ${enc.doctorName}`;

    if (sections.length > 0) {
      entries.push({ type: 'encounter', date: enc.date, doctorLabel, sections });
    }

    for (const img of enc.imageAttachments || []) {
      entries.push({
        type: 'image-attachment',
        date: enc.date,
        doctorLabel,
        imageBuffer: img.buffer,
        imageMime: img.mimeType,
        imageFileName: img.fileName,
      });
    }

    for (const name of enc.pdfAttachmentNames || []) {
      entries.push({ type: 'pdf-attachment', date: enc.date, doctorLabel, pdfFileName: name });
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
        resultSections.push({ label: tl(schema.label), lines });
      } else {
        const customForm = customFormByKey.get(result.type);
        if (!customForm) continue;
        const lines = extractCustomFormLines(customForm.schema, data, t, options.locale);
        if (lines.length === 0) continue;
        resultSections.push({ label: tl(customForm.label || customForm.schema.label), lines });
      }
    }

    if (resultSections.length === 0) continue;

    const hasAnyReference = resultSections.some(s => s.lines.some(l => l.reference));
    const doctorLabel = study.referringDoctor
      ? `${t.referringDoctor} ${study.referringDoctor}`
      : `${study.doctorTitle} ${study.doctorName}`;

    entries.push({
      type: 'study',
      date: study.date,
      doctorLabel,
      resultSections,
      hasAnyReference,
      protocol: study.protocol,
    });
  }

  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // --- Render header ---

  const licenseLines: string[] = [];
  if (doctor.specialty) licenseLines.push(doctor.specialty);
  if (doctor.nationalLicenseNumber) licenseLines.push(`M.N. ${doctor.nationalLicenseNumber}`);
  if (doctor.stateLicense && doctor.stateLicenseNumber) {
    licenseLines.push(`M.P. (${getProvinceName(doctor.stateLicense, options.locale)}) ${doctor.stateLicenseNumber}`);
  }

  const headerHtml = `
    <header class="header">
      ${organizationLogoUrl ? `<img class="org-logo" src="${esc(organizationLogoUrl)}" alt="">` : ''}
      <div>
        <div class="org-name">${esc(organizationName)}</div>
        <div class="doctor-info">${esc(doctor.title)} ${esc(doctor.fullName)}${licenseLines.length > 0 ? ` &mdash; ${licenseLines.map(esc).join(' | ')}` : ''}</div>
      </div>
    </header>`;

  // --- Render patient block ---

  const patientRows: string[] = [
    `<div class="patient-row"><span class="patient-label">${esc(t.fullName)}:</span><span class="patient-value">${esc(patient.fullName)}</span></div>`,
  ];
  if (patient.documentType && patient.documentValue) {
    patientRows.push(`<div class="patient-row"><span class="patient-label">${esc(patient.documentType)}:</span><span class="patient-value">${esc(patient.documentValue)}</span></div>`);
  }
  if (patient.birthDate) {
    patientRows.push(`<div class="patient-row"><span class="patient-label">${esc(t.birthDate)}:</span><span class="patient-value">${esc(dayjs.utc(patient.birthDate).format('DD/MM/YYYY'))}</span></div>`);
  }
  if (patient.medicare) {
    const insuranceValue = patient.medicarePlan ? `${patient.medicare} &mdash; ${patient.medicarePlan}` : patient.medicare;
    patientRows.push(`<div class="patient-row"><span class="patient-label">${esc(t.healthInsurance)}:</span><span class="patient-value">${esc(insuranceValue)}</span></div>`);
  }

  const patientHtml = `
    <div class="section-title">${esc(t.patientData)}</div>
    <div class="patient-block">${patientRows.join('')}</div>`;

  // --- Date range ---

  const dateRangeText = startDate && endDate
    ? `${t.periodRange} ${dayjs(startDate).format('DD/MM/YYYY')} ${t.periodTo} ${dayjs(endDate).format('DD/MM/YYYY')}`
    : t.fullHistory;

  const dateRangeHtml = `<div class="date-range">${esc(dateRangeText)}</div>`;

  // --- Timeline ---

  const timelineHtml = entries.length === 0
    ? `<div class="empty-note">${esc(t.noRecords)}</div>`
    : `<div class="timeline">${entries.map((entry, i) => {
      const isFirst = i === 0;
      const isLast = i === entries.length - 1;

      const colors = entry.type === 'encounter' ? COLORS.encounter
        : entry.type === 'study' ? COLORS.study
          : COLORS.attachment;

      const typeLabel = entry.type === 'encounter' ? t.encounter
        : entry.type === 'study' ? t.study
          : t.attachmentLabel;

      const dateLabel = entry.type === 'study' && entry.protocol
        ? `${dayjs(entry.date).format('DD/MM/YYYY')} &mdash; ${esc(t.protocol)} #${entry.protocol}`
        : dayjs(entry.date).format('DD/MM/YYYY');

      let bodyHtml = '';
      if (entry.type === 'encounter' && entry.sections) {
        bodyHtml = renderSections(entry.sections);
      } else if (entry.type === 'study' && entry.resultSections) {
        bodyHtml = renderSections(entry.resultSections, entry.hasAnyReference);
      } else if (entry.type === 'image-attachment' && entry.imageBuffer) {
        const b64 = Buffer.from(entry.imageBuffer).toString('base64');
        bodyHtml = `
            <img class="attachment-image" src="data:${entry.imageMime};base64,${b64}" alt="${esc(entry.imageFileName)}">
            <div class="attachment-filename">${esc(entry.imageFileName)}</div>`;
      } else if (entry.type === 'pdf-attachment') {
        bodyHtml = `
            <div class="attachment-filename">${esc(entry.pdfFileName)}</div>
            <div class="attachment-note">${esc(t.seeAppendedPages)}</div>`;
      }

      return /* HTML */ `
          <div class="entry">
            <div class="entry-gutter">
              ${!isFirst ? '<div class="entry-gutter-line" style="height:6px"></div>' : ''}
              <div class="entry-gutter-dot" style="background:${colors.dot}"></div>
              ${!isLast ? '<div class="entry-gutter-line" style="flex:1;min-height:14px"></div>' : ''}
            </div>
            <div class="entry-main${isLast ? ' last' : ''}">
              <div class="entry-header" style="background:${colors.bg}">
                <div class="entry-date-row">
                  <span class="entry-date" style="color:${colors.text}">${dateLabel}</span>
                  <span class="entry-badge" style="background:${colors.dot}">${esc(typeLabel)}</span>
                </div>
                <div class="entry-doctor">${esc(entry.doctorLabel)}</div>
              </div>
              <div class="entry-body">${bodyHtml}</div>
            </div>
          </div>`;
    }).join('')}</div>`;

  // --- Study signature stamp ---

  const studySignature = options.studySignature;
  const studySignatureHtml = studySignature ? `
    <div class="study-signature-block">
      <img class="study-signature-image" src="data:image/png;base64,${esc(studySignature.image)}" alt="">
      <div class="study-signature-name">${esc(studySignature.doctorTitle)} ${esc(studySignature.doctorName)}</div>
      ${studySignature.licenseNumber ? `<div class="study-signature-license">M.N. ${esc(studySignature.licenseNumber)}</div>` : ''}
      ${studySignature.stateLicense && studySignature.stateLicenseNumber ? `<div class="study-signature-license">M.P. (${esc(getProvinceName(studySignature.stateLicense, options.locale))}) ${esc(studySignature.stateLicenseNumber)}</div>` : ''}
    </div>` : '';

  // --- Signature ---

  const signatureHtml = isSigned ? `
    <div class="signature-block">
      <div class="signature-text">${esc(t.signedBy)} ${esc(doctor.fullName)}</div>
      ${doctor.nationalLicenseNumber ? `<div class="signature-text">M.N. ${esc(doctor.nationalLicenseNumber)}</div>` : ''}
    </div>` : '';

  // --- Footer ---

  const footerHtml = `
    <div class="footer">
      <span>${esc(t.generatedOn)} ${dayjs().format('DD/MM/YYYY HH:mm')}</span>
    </div>`;

  return `<!DOCTYPE html>
<html lang="${esc(options.locale ?? 'es')}">
<head>
  <meta charset="utf-8">
  <title>${esc(patient.fullName)} &mdash; ${esc(organizationName)}</title>
  <style>${CSS}</style>
</head>
<body>
  ${headerHtml}
  ${patientHtml}
  ${dateRangeHtml}
  ${timelineHtml}
  ${studySignatureHtml}
  ${signatureHtml}
  ${footerHtml}
</body>
</html>`;
}
