export interface StudyFieldReference {
  male?: string;
  female?: string;
  child?: string;
  o?: string;
  other?: string;
}

export interface StudySelectOption {
  value: string;
  label: string;
}

export interface StudyField {
  name?: string;
  label?: string;
  type: 'input' | 'textarea' | 'select' | 'title' | 'title-input' | 'separator' | 'date' | 'tri-state-checkbox' | 'icd10' | 'medication';
  pattern?: string;
  placeholder?: string;
  reference?: string | StudyFieldReference;
  unit?: string;
  method?: string;
  options?: StudySelectOption[];
  addsExtraCost?: boolean;
  colSpan?: number;
}

export interface StudySchema {
  name: string;
  label: string;
  showMethod?: boolean;
  fields: StudyField[];
}

export type StudySelectValue = { value: string; label: string } | null;

export type StudyResultData = Record<string, string | StudySelectValue>;

export interface ExtraCostSection {
  name: string;
  label: string;
  fieldNames: string[];
}

export function getExtraCostSections(schema: StudySchema): ExtraCostSection[] {
  const sections: ExtraCostSection[] = [];
  let current: ExtraCostSection | null = null;

  for (const field of schema.fields) {
    if (field.type === 'title' || field.type === 'separator') {
      if (current) {
        sections.push(current);
        current = null;
      }
      if (field.addsExtraCost && field.name && field.label) {
        current = { name: field.name, label: field.label, fieldNames: [] };
      }
      continue;
    }

    if (current && field.name) {
      current.fieldNames.push(field.name);
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}
