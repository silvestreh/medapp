import type { EncounterField, EncounterSchema } from './types';
import type { StudyField, StudySchema } from './study-types';
import type { Fieldset, FormTemplateSchema } from './fieldset-types';

let idCounter = 0;
function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${++idCounter}`;
  }
}

/**
 * Converts a flat StudySchema into fieldsets by splitting on title/separator
 * boundaries. Title fields with `addsExtraCost` propagate to the fieldset.
 */
export function studySchemaToFieldsets(
  schema: StudySchema
): Fieldset<StudyField>[] {
  const fieldsets: Fieldset<StudyField>[] = [];
  let current: Fieldset<StudyField> = {
    id: generateId(),
    fields: [],
  };

  for (const field of schema.fields) {
    const isBoundary = field.type === 'title' || field.type === 'separator';

    if (isBoundary) {
      // Push the accumulated fieldset if it has fields
      if (current.fields.length > 0) {
        fieldsets.push(current);
      }

      // Start a new fieldset from this boundary
      current = {
        id: generateId(),
        title: field.label,
        extraCost: field.addsExtraCost || undefined,
        fields: [],
      };
      continue;
    }

    current.fields.push(field);
  }

  // Push the last fieldset
  if (current.fields.length > 0 || current.title) {
    fieldsets.push(current);
  }

  // If schema had no boundaries at all, ensure at least one fieldset
  if (fieldsets.length === 0) {
    fieldsets.push({ id: generateId(), fields: [] });
  }

  return fieldsets;
}

/**
 * Converts a flat EncounterSchema into fieldsets. Encounter schemas don't use
 * extraCost, and their title fields act as section headers.
 */
export function encounterSchemaToFieldsets(
  schema: EncounterSchema
): Fieldset<EncounterField>[] {
  const fieldsets: Fieldset<EncounterField>[] = [];
  let current: Fieldset<EncounterField> = {
    id: generateId(),
    fields: [],
  };

  for (const field of schema.fields) {
    if (field.type === 'title') {
      // Push the accumulated fieldset if it has fields
      if (current.fields.length > 0) {
        fieldsets.push(current);
      }

      current = {
        id: generateId(),
        title: field.label,
        fields: [],
      };
      continue;
    }

    if (field.type === 'separator') {
      if (current.fields.length > 0) {
        fieldsets.push(current);
      }
      current = { id: generateId(), fields: [] };
      continue;
    }

    current.fields.push(field);
  }

  if (current.fields.length > 0 || current.title) {
    fieldsets.push(current);
  }

  if (fieldsets.length === 0) {
    fieldsets.push({ id: generateId(), fields: [] });
  }

  return fieldsets;
}

/**
 * Flattens fieldsets back into a flat StudyField array, reinserting title/separator
 * fields at fieldset boundaries so the existing StudyForm renderer works unchanged.
 */
export function fieldsetsToStudyFields(
  fieldsets: Fieldset<StudyField>[]
): StudyField[] {
  const fields: StudyField[] = [];

  for (let i = 0; i < fieldsets.length; i++) {
    const fs = fieldsets[i];

    if (fs.title) {
      const titleField: StudyField = {
        type: 'title',
        name: `section_${i}`,
        label: fs.title,
      };
      if (fs.extraCost) {
        titleField.addsExtraCost = true;
      }
      fields.push(titleField);
    } else if (i > 0) {
      // No title but not the first fieldset — insert a separator
      fields.push({ type: 'separator' });
    }

    fields.push(...fs.fields);
  }

  return fields;
}

/**
 * Flattens fieldsets back into a flat EncounterField array, reinserting title
 * fields at fieldset boundaries. Repeatable fieldsets become EncounterArrayFields.
 */
export function fieldsetsToEncounterFields(
  fieldsets: Fieldset<EncounterField>[]
): EncounterField[] {
  const fields: EncounterField[] = [];

  for (let i = 0; i < fieldsets.length; i++) {
    const fs = fieldsets[i];

    if (fs.repeatable) {
      // Repeatable fieldsets render their title via the ArrayNode label,
      // so don't emit a separate title field.
    } else if (fs.title) {
      fields.push({
        type: 'title' as const,
        label: fs.title,
      });
    } else if (i > 0) {
      fields.push({ type: 'separator' as const });
    }

    if (fs.repeatable) {
      fields.push({
        type: 'array' as const,
        name: `repeater_${fs.id || i}`,
        label: fs.title,
        addLabel: fs.addLabel || 'Add item',
        itemLabel: fs.itemLabel || 'Item #{{index}}',
        minItems: fs.minItems ?? 1,
        itemFields: fs.fields,
      });
    } else {
      fields.push(...fs.fields);
    }
  }

  return fields;
}

/**
 * Converts a FormTemplateSchema (with fieldsets) into a flat EncounterSchema
 * suitable for the existing EncounterSchemaForm renderer.
 */
export function templateToEncounterSchema(
  template: FormTemplateSchema
): EncounterSchema {
  return {
    name: template.name,
    formKey: `custom/${template.name}`,
    label: template.label,
    fields: fieldsetsToEncounterFields(
      template.fieldsets as Fieldset<EncounterField>[]
    ),
  };
}

/**
 * Converts a FormTemplateSchema (with fieldsets) into a flat StudySchema
 * suitable for the existing StudyForm renderer.
 */
export function templateToStudySchema(
  template: FormTemplateSchema
): StudySchema {
  return {
    name: template.name,
    label: template.label,
    showMethod: template.showMethod,
    fields: fieldsetsToStudyFields(
      template.fieldsets as Fieldset<StudyField>[]
    ),
  };
}
