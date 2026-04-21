import { useCallback, useMemo } from 'react';
import { Divider, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useBuilder } from '../../builder-context';
import { findFieldRecursive } from '../../builder-reducer';
import type { AnyField, BuilderField } from '../../builder-types';
import { SectionTitle } from './styles';
import { InputProperties } from './type-editors/input-properties';
import { TextareaProperties } from './type-editors/textarea-properties';
import { SelectProperties } from './type-editors/select-properties';
import { DateProperties } from './type-editors/date-properties';
import { CheckboxProperties } from './type-editors/checkbox-properties';
import { Icd10Properties } from './type-editors/icd10-properties';
import { GroupProperties } from './type-editors/group-properties';

interface FieldPropertiesProps {
  field: BuilderField;
}

export type UpdateFn = (changes: Partial<AnyField>) => void;

export function FieldProperties({ field: bf }: FieldPropertiesProps) {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();
  const field = bf.field;

  const parentFieldset = useMemo(
    () =>
      state.fieldsets.find(fs => {
        if (findFieldRecursive(fs.fields, bf._id)) return true;
        return fs.tabs?.some(tab => findFieldRecursive(tab.fields, bf._id)) ?? false;
      }),
    [state.fieldsets, bf._id]
  );
  const parentColumns = parentFieldset?.columns || 1;

  const updateField = useCallback<UpdateFn>(
    changes => {
      dispatch({ type: 'UPDATE_FIELD', payload: { fieldId: bf._id, changes } });
    },
    [dispatch, bf._id]
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField({ name: e.target.value }),
    [updateField]
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField({ label: e.target.value }),
    [updateField]
  );

  const handlePlaceholderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => updateField({ placeholder: e.target.value }),
    [updateField]
  );

  const handleColSpanChange = useCallback(
    (v: number | string) => updateField({ colSpan: typeof v === 'number' ? v : 1 }),
    [updateField]
  );

  return (
    <Stack gap="sm">
      <SectionTitle>{t('form_builder.field_properties')}</SectionTitle>
      <Text size="xs" c="dimmed" fw={600}>
        {t('form_builder.field_type')}: {field.type}
      </Text>

      {'name' in field && (
        <TextInput
          label={t('form_builder.field_name')}
          description={t('form_builder.field_name_description')}
          value={field.name ?? ''}
          onChange={handleNameChange}
        />
      )}

      <TextInput label={t('form_builder.field_label')} value={field.label ?? ''} onChange={handleLabelChange} />

      <TextInput
        label={t('form_builder.field_placeholder')}
        value={field.placeholder ?? ''}
        onChange={handlePlaceholderChange}
      />

      {parentColumns > 1 && (
        <NumberInput
          label={t('form_builder.col_span')}
          description={t('form_builder.col_span_description', { columns: parentColumns })}
          value={field.colSpan || 1}
          min={1}
          max={parentColumns}
          onChange={handleColSpanChange}
        />
      )}

      <Divider my="xs" />

      {field.type === 'input' && <InputProperties field={field} onUpdate={updateField} />}
      {field.type === 'textarea' && <TextareaProperties field={field} onUpdate={updateField} />}
      {field.type === 'select' && <SelectProperties field={field} onUpdate={updateField} />}
      {field.type === 'date' && <DateProperties field={field} onUpdate={updateField} />}
      {field.type === 'tri-state-checkbox' && <CheckboxProperties field={field} onUpdate={updateField} />}
      {field.type === 'icd10' && <Icd10Properties field={field} onUpdate={updateField} />}
      {field.type === 'group' && <GroupProperties field={field} onUpdate={updateField} />}
    </Stack>
  );
}
