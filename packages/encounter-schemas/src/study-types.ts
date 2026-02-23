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

export type StudySelectValue = { value: string; label: string } | null;

export type StudyResultData = Record<string, string | StudySelectValue>;
