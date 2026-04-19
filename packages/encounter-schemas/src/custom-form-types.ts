import type { SelectOption, SelectOptionGroup } from './types';

export interface CustomFormFieldBase {
  name?: string;
  label?: string;
  placeholder?: string;
  variant?: 'stacked' | 'checkbox' | 'noOffset' | 'nested';
  indent?: boolean;
  colSpan?: number;
  // Study-specific properties (available on any field, rendered when applicable)
  pattern?: string;
  reference?: string | { male?: string; female?: string; child?: string; o?: string; other?: string };
  unit?: string;
  method?: string;
}

export interface CustomFormInputField extends CustomFormFieldBase {
  type: 'input';
  inputType?: 'text' | 'number';
}

export interface CustomFormTextareaField extends CustomFormFieldBase {
  type: 'textarea';
  minRows?: number;
}

export interface CustomFormSelectField extends CustomFormFieldBase {
  type: 'select';
  options: SelectOption[] | SelectOptionGroup[];
  clearable?: boolean;
}

export interface CustomFormDateField extends CustomFormFieldBase {
  type: 'date';
  valueFormat?: string;
}

export interface CustomFormCheckboxField extends CustomFormFieldBase {
  type: 'tri-state-checkbox';
}

export interface CustomFormIcd10Field extends CustomFormFieldBase {
  type: 'icd10';
  multi?: boolean;
}

export interface CustomFormMedicationField extends CustomFormFieldBase {
  type: 'medication';
}

export interface CustomFormSeparatorField extends CustomFormFieldBase {
  type: 'separator';
}

export interface CustomFormTabDef {
  value: string;
  label: string;
  fields: CustomFormField[];
}

export interface CustomFormTabsField extends CustomFormFieldBase {
  type: 'tabs';
  tabStyle?: 'pills' | 'default';
  grow?: boolean;
  tabs: CustomFormTabDef[];
}

export interface CustomFormGroupField extends CustomFormFieldBase {
  type: 'group';
  toggleLabel?: string;
  fields: CustomFormField[];
}

export type CustomFormField =
  | CustomFormInputField
  | CustomFormTextareaField
  | CustomFormSelectField
  | CustomFormDateField
  | CustomFormCheckboxField
  | CustomFormIcd10Field
  | CustomFormMedicationField
  | CustomFormSeparatorField
  | CustomFormTabsField
  | CustomFormGroupField;

export type CustomFormValues = Record<string, any>;
