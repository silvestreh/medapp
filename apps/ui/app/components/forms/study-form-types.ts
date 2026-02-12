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
  type: 'input' | 'textarea' | 'select' | 'title' | 'title-input' | 'separator';
  pattern?: string;
  placeholder?: string;
  reference?: string | StudyFieldReference;
  unit?: string;
  method?: string;
  options?: StudySelectOption[];
}

export interface StudySchema {
  name: string;
  label: string;
  showMethod?: boolean;
  fields: StudyField[];
}

/**
 * Legacy select values are stored as `{ value, label }` objects
 * in the database, not just plain strings.
 */
export type StudySelectValue = { value: string; label: string } | null;

/**
 * The data shape for a study result.
 * Keys are field names, values are strings (for input/textarea)
 * or `{ value, label }` objects (for selects).
 */
export type StudyResultData = Record<string, string | StudySelectValue>;
