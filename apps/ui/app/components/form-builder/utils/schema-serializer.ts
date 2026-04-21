import type { FormTemplateSchema, Fieldset, CustomFormField } from '@athelas/encounter-schemas';
import type { BuilderState, BuilderField, BuilderFieldset, AnyField } from '../builder-types';

function uuid(): string {
  return crypto.randomUUID();
}

function fieldToBuilderField(field: AnyField): BuilderField {
  const bf: BuilderField = { _id: uuid(), field };
  if (field.type === 'group' && Array.isArray(field.fields)) {
    bf._groupChildren = field.fields.map(fieldToBuilderField);
  }
  return bf;
}

function builderFieldToSchema(bf: BuilderField): CustomFormField {
  if (bf.field.type === 'group' && bf._groupChildren) {
    return { ...bf.field, fields: bf._groupChildren.map(builderFieldToSchema) };
  }
  return bf.field;
}

/**
 * Converts a FormTemplateSchema from the API into BuilderState,
 * assigning temporary _id fields for DnD and React keys.
 */
export function schemaToBuilderState(schema: FormTemplateSchema, formType: 'encounter' | 'study'): BuilderState {
  const fieldsets: BuilderFieldset[] = schema.fieldsets.map(fs => {
    const result: BuilderFieldset = {
      _id: uuid(),
      title: fs.title,
      extraCost: fs.extraCost,
      labelPosition: fs.labelPosition,
      columns: fs.columns,
      repeatable: fs.repeatable,
      addLabel: fs.addLabel,
      itemLabel: fs.itemLabel,
      minItems: fs.minItems,
      tabStyle: fs.tabStyle,
      fields: fs.fields.map(fieldToBuilderField),
    };
    if (fs.tabs) {
      result.tabs = fs.tabs.map(tab => ({
        _id: uuid(),
        value: tab.value,
        label: tab.label,
        fields: tab.fields.map(fieldToBuilderField),
      }));
      result.activeTabId = result.tabs[0]?._id;
    }
    return result;
  });

  // Ensure at least one fieldset
  if (fieldsets.length === 0) {
    fieldsets.push({ _id: uuid(), fields: [] });
  }

  return {
    type: formType,
    name: schema.name,
    label: schema.label,
    fieldsets,
    selectedFieldId: null,
    selectedFieldsetId: null,
    isDirty: false,
  };
}

/**
 * Converts BuilderState back into a FormTemplateSchema for API persistence,
 * stripping temporary _id fields.
 */
export function builderStateToSchema(state: BuilderState): FormTemplateSchema {
  const fieldsets: Fieldset<CustomFormField>[] = state.fieldsets.map((fs, index) => {
    const result: Fieldset<CustomFormField> = {
      id: `fieldset-${index}`,
      title: fs.title,
      extraCost: fs.extraCost,
      labelPosition: fs.labelPosition,
      columns: fs.columns,
      repeatable: fs.repeatable,
      addLabel: fs.addLabel,
      itemLabel: fs.itemLabel,
      minItems: fs.minItems,
      tabStyle: fs.tabStyle,
      fields: fs.fields.map(builderFieldToSchema),
    };
    if (fs.tabs) {
      result.tabs = fs.tabs.map(tab => ({
        value: tab.value,
        label: tab.label,
        fields: tab.fields.map(builderFieldToSchema),
      }));
    }
    return result;
  });

  return {
    name: state.name,
    label: state.label,
    type: state.type,
    fieldsets,
  };
}

/**
 * Creates an empty BuilderState for a new form.
 */
export function createEmptyBuilderState(formType: 'encounter' | 'study'): BuilderState {
  return {
    type: formType,
    name: '',
    label: '',
    fieldsets: [
      {
        _id: uuid(),
        fields: [],
      },
    ],
    selectedFieldId: null,
    selectedFieldsetId: null,
    isDirty: false,
  };
}
