export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectOptionGroup {
  group: string;
  items: SelectOption[];
}

export interface FieldCondition {
  field: string;
  operator: 'eq' | 'neq' | 'truthy' | 'falsy' | 'in' | 'not_empty';
  value?: any;
}

interface FieldBase {
  name?: string;
  label?: string;
  placeholder?: string;
  condition?: FieldCondition;
  variant?: 'stacked' | 'checkbox' | 'noOffset' | 'nested';
  indent?: boolean;
}

export interface EncounterInputField extends FieldBase {
  type: 'input';
  inputType?: 'text' | 'number';
}

export interface EncounterTextareaField extends FieldBase {
  type: 'textarea';
  minRows?: number;
}

export interface EncounterSelectField extends FieldBase {
  type: 'select';
  options: SelectOption[] | SelectOptionGroup[];
  clearable?: boolean;
}

export interface EncounterDateField extends FieldBase {
  type: 'date';
  valueFormat?: string;
}

export interface EncounterTriStateField extends FieldBase {
  type: 'tri-state-checkbox';
}

export interface EncounterIcd10Field extends FieldBase {
  type: 'icd10';
  multi?: boolean;
}

export interface EncounterMedicationField extends FieldBase {
  type: 'medication';
}

export interface EncounterTitleField extends FieldBase {
  type: 'title';
}

export interface EncounterTextField extends FieldBase {
  type: 'text';
}

export interface EncounterSeparatorField extends FieldBase {
  type: 'separator';
}

export interface EncounterTabDef {
  value: string;
  label: string;
  fields: EncounterField[];
}

export interface EncounterTabsField extends FieldBase {
  type: 'tabs';
  tabStyle?: 'pills' | 'default';
  grow?: boolean;
  tabs: EncounterTabDef[];
}

export interface EncounterGroupField extends FieldBase {
  type: 'group';
  fields: EncounterField[];
}

export interface EncounterArrayField extends FieldBase {
  type: 'array';
  addLabel?: string;
  itemLabel?: string;
  itemFields: EncounterField[];
  minItems?: number;
}

export type EncounterField =
  | EncounterInputField
  | EncounterTextareaField
  | EncounterSelectField
  | EncounterDateField
  | EncounterTriStateField
  | EncounterIcd10Field
  | EncounterMedicationField
  | EncounterTitleField
  | EncounterTextField
  | EncounterSeparatorField
  | EncounterTabsField
  | EncounterGroupField
  | EncounterArrayField;

export interface EncounterSchema {
  name: string;
  formKey: string;
  label: string;
  fields: EncounterField[];
}

export type EncounterFormValues = Record<string, any>;

export interface EncounterFormAdapter {
  fromLegacy: (data?: { type: string; values: Record<string, any> }) => EncounterFormValues;
  toLegacy: (values: EncounterFormValues) => { type: string; values: Record<string, any> };
}
