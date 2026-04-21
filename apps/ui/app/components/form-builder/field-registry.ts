import {
  TextTIcon,
  NoteBlankIcon,
  ListBulletsIcon,
  CalendarBlankIcon,
  CheckSquareIcon,
  FirstAidKitIcon,
  PillIcon,
  MinusIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react';
import type { CustomFormField } from '@athelas/encounter-schemas';
import type { TranslationKeys } from '~/i18n/i18n';
import type { CreatableFieldType } from './utils/field-defaults';

type FormBuilderKey = keyof TranslationKeys['form_builder'];

export interface FieldMetadata {
  icon: React.ElementType;
  labelKey: FormBuilderKey;
  category: 'input' | 'structural';
}

export const FIELD_METADATA: Record<CreatableFieldType, FieldMetadata> = {
  input: { icon: TextTIcon, labelKey: 'palette_input', category: 'input' },
  textarea: { icon: NoteBlankIcon, labelKey: 'palette_textarea', category: 'input' },
  select: { icon: ListBulletsIcon, labelKey: 'palette_select', category: 'input' },
  date: { icon: CalendarBlankIcon, labelKey: 'palette_date', category: 'input' },
  'tri-state-checkbox': { icon: CheckSquareIcon, labelKey: 'palette_checkbox', category: 'input' },
  icd10: { icon: FirstAidKitIcon, labelKey: 'palette_icd10', category: 'input' },
  medication: { icon: PillIcon, labelKey: 'palette_medication', category: 'input' },
  separator: { icon: MinusIcon, labelKey: 'palette_separator', category: 'structural' },
  group: { icon: SquaresFourIcon, labelKey: 'palette_group', category: 'structural' },
};

export const INPUT_FIELD_TYPES = (Object.keys(FIELD_METADATA) as CreatableFieldType[]).filter(
  t => FIELD_METADATA[t].category === 'input'
);

export const STRUCTURAL_FIELD_TYPES = (Object.keys(FIELD_METADATA) as CreatableFieldType[]).filter(
  t => FIELD_METADATA[t].category === 'structural'
);

export type AllFieldType = CustomFormField['type'];
