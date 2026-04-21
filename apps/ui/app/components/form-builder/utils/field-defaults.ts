import type { CustomFormField } from '@athelas/encounter-schemas';
import type { BuilderField, BuilderFieldset } from '../builder-types';

export type CreatableFieldType = Exclude<CustomFormField['type'], 'tabs'>;

function collectFieldNames(fieldsets: BuilderFieldset[]): Set<string> {
  const names = new Set<string>();
  const visit = (bfs: BuilderField[]) => {
    for (const bf of bfs) {
      if (bf.field.name) names.add(bf.field.name);
      if (bf._groupChildren) visit(bf._groupChildren);
    }
  };
  for (const fs of fieldsets) {
    visit(fs.fields);
    fs.tabs?.forEach(tab => visit(tab.fields));
  }
  return names;
}

function makeNameFactory(existing: Set<string>): (prefix: string) => string {
  const counts = new Map<string, number>();
  for (const name of existing) {
    const match = /^(.+)_(\d+)$/.exec(name);
    if (match) {
      counts.set(match[1], Math.max(counts.get(match[1]) ?? 0, Number(match[2])));
    }
  }
  return prefix => {
    let next = (counts.get(prefix) ?? 0) + 1;
    let name = `${prefix}_${next}`;
    while (existing.has(name)) {
      next += 1;
      name = `${prefix}_${next}`;
    }
    counts.set(prefix, next);
    existing.add(name);
    return name;
  };
}

export function createDefaultField(fieldType: CreatableFieldType, fieldsets: BuilderFieldset[]): CustomFormField {
  const nextName = makeNameFactory(collectFieldNames(fieldsets));
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
        variant: 'checkbox',
        indent: true,
      };
    case 'icd10':
      return { type: 'icd10', name: nextName('icd10'), label: 'ICD-10' };
    case 'medication':
      return { type: 'medication', name: nextName('medication'), label: 'Medication' };
    case 'separator':
      return { type: 'separator' };
    case 'group':
      return { type: 'group', name: nextName('group'), toggleLabel: 'Group', fields: [] };
  }
}
