import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

const ENCOUNTER_FIELD_TYPES = new Set([
  'input', 'textarea', 'select', 'date', 'tri-state-checkbox',
  'icd10', 'medication', 'title', 'text', 'separator',
  'tabs', 'group', 'array',
]);

const STUDY_FIELD_TYPES = new Set([
  'input', 'textarea', 'select', 'title', 'title-input', 'separator',
  'date', 'tri-state-checkbox', 'icd10', 'medication',
]);

function validateFieldNames(fields: any[], names: Set<string>, errors: string[]): void {
  for (const field of fields) {
    if (field.name) {
      if (names.has(field.name)) {
        errors.push(`Duplicate field name: "${field.name}"`);
      }
      names.add(field.name);
    }

    // Recurse into nested fields
    if (field.fields && Array.isArray(field.fields)) {
      validateFieldNames(field.fields, names, errors);
    }
    if (field.itemFields && Array.isArray(field.itemFields)) {
      validateFieldNames(field.itemFields, names, errors);
    }
    if (field.tabs && Array.isArray(field.tabs)) {
      for (const tab of field.tabs) {
        if (tab.fields && Array.isArray(tab.fields)) {
          validateFieldNames(tab.fields, names, errors);
        }
      }
    }
  }
}

function validateFields(fields: any[], allowedTypes: Set<string>, errors: string[]): void {
  for (const field of fields) {
    if (!field.type) {
      errors.push('Field is missing "type" property');
      continue;
    }

    if (!allowedTypes.has(field.type)) {
      errors.push(`Invalid field type: "${field.type}"`);
    }

    if (field.pattern) {
      try {
        new RegExp(field.pattern);
      } catch {
        errors.push(`Invalid regex pattern for field "${field.name}": "${field.pattern}"`);
      }
    }

    if (field.type === 'select' && (!field.options || !Array.isArray(field.options))) {
      errors.push(`Select field "${field.name}" must have an "options" array`);
    }

    // Recurse into composite fields
    if (field.type === 'group' && field.fields) {
      validateFields(field.fields, allowedTypes, errors);
    }
    if (field.type === 'array' && field.itemFields) {
      validateFields(field.itemFields, allowedTypes, errors);
    }
    if (field.type === 'tabs' && field.tabs) {
      for (const tab of field.tabs) {
        if (tab.fields) {
          validateFields(tab.fields, allowedTypes, errors);
        }
      }
    }
  }
}

export const validateSchema = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const schema = context.data?.schema;

    if (!schema) {
      return context;
    }

    const errors: string[] = [];
    const formType = context.data?.type;

    // Determine the template type — for patches, we may need to look it up
    let type = formType;
    if (!type && context.id) {
      const existing = await context.app.service('form-templates').get(context.id);
      type = existing.type;
    }

    if (!type) {
      errors.push('Cannot determine form type for schema validation');
    }

    const allowedTypes = type === 'study' ? STUDY_FIELD_TYPES : ENCOUNTER_FIELD_TYPES;

    if (!schema.fieldsets || !Array.isArray(schema.fieldsets)) {
      errors.push('Schema must have a "fieldsets" array');
    } else {
      const fieldNames = new Set<string>();

      for (const fieldset of schema.fieldsets) {
        if (!fieldset.fields || !Array.isArray(fieldset.fields)) {
          errors.push('Each fieldset must have a "fields" array');
          continue;
        }

        validateFields(fieldset.fields, allowedTypes, errors);
        validateFieldNames(fieldset.fields, fieldNames, errors);
      }
    }

    if (errors.length > 0) {
      throw new BadRequest('Invalid form schema', { errors });
    }

    return context;
  };
};
