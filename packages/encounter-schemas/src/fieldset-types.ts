import type { EncounterField } from './types';
import type { StudyField } from './study-types';
import type { CustomFormField } from './custom-form-types';

export interface FieldsetTab<F = EncounterField | StudyField> {
  value: string;
  label: string;
  fields: F[];
}

export interface Fieldset<F = EncounterField | StudyField> {
  id: string;
  title?: string;
  extraCost?: boolean;
  labelPosition?: 'left' | 'top';
  columns?: number;
  repeatable?: boolean;
  addLabel?: string;
  itemLabel?: string;
  minItems?: number;
  tabs?: FieldsetTab<F>[];
  tabStyle?: 'pills' | 'default';
  fields: F[];
}

export interface FormTemplateSchema {
  name: string;
  label: string;
  type: 'encounter' | 'study';
  fieldsets: Fieldset<CustomFormField>[];
  showMethod?: boolean;
}
