import type { CustomFormField } from '@athelas/encounter-schemas';

let counter = 0;
function nextName(prefix: string): string {
  counter++;
  return `${prefix}_${counter}`;
}

export function createDefaultField(fieldType: CustomFormField['type']): CustomFormField {
  switch (fieldType) {
    case 'input':
      return { type: 'input', name: nextName('input'), label: 'Text Input', inputType: 'text' };
    case 'textarea':
      return { type: 'textarea', name: nextName('textarea'), label: 'Text Area', minRows: 2 };
    case 'select':
      return {
        type: 'select',
        name: nextName('select'),
        label: 'Select',
        options: [{ value: 'option1', label: 'Option 1' }],
        clearable: true,
      };
    case 'date':
      return { type: 'date', name: nextName('date'), label: 'Date', valueFormat: 'DD/MM/YYYY' };
    case 'tri-state-checkbox':
      return {
        type: 'tri-state-checkbox',
        name: nextName('checkbox'),
        label: 'Checkbox',
        variant: 'checkbox' as const,
        indent: true,
      };
    case 'icd10':
      return { type: 'icd10', name: nextName('icd10'), label: 'ICD-10' };
    case 'medication':
      return { type: 'medication', name: nextName('medication'), label: 'Medication' };
    case 'separator':
      return { type: 'separator' };
    case 'tabs':
      return {
        type: 'tabs',
        tabStyle: 'default',
        grow: true,
        tabs: [{ value: 'tab1', label: 'Tab 1', fields: [] }],
      };
    case 'group':
      return { type: 'group', name: nextName('group'), toggleLabel: 'Group', fields: [] };
    default:
      return { type: 'input', name: nextName('input'), label: 'Field' };
  }
}
