import { useCallback } from 'react';
import { Select, Stack, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CustomFormInputField } from '@athelas/encounter-schemas';
import type { UpdateFn } from '../field-properties';

interface Props {
  field: CustomFormInputField;
  onUpdate: UpdateFn;
}

export function InputProperties({ field, onUpdate }: Props) {
  const { t } = useTranslation();

  const handleInputTypeChange = useCallback(
    (v: string | null) => onUpdate({ inputType: v === 'number' ? 'number' : 'text' }),
    [onUpdate]
  );

  const handlePatternChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ pattern: e.target.value }),
    [onUpdate]
  );

  const handleReferenceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ reference: e.target.value }),
    [onUpdate]
  );

  const handleUnitChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ unit: e.target.value }),
    [onUpdate]
  );

  const handleMethodChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ method: e.target.value }),
    [onUpdate]
  );

  return (
    <Stack gap="xs">
      <Select
        label={t('form_builder.input_type')}
        data={[
          { value: 'text', label: t('form_builder.input_type_text') },
          { value: 'number', label: t('form_builder.input_type_number') },
        ]}
        value={field.inputType ?? 'text'}
        onChange={handleInputTypeChange}
      />
      <TextInput
        label={t('form_builder.pattern')}
        value={field.pattern ?? ''}
        onChange={handlePatternChange}
        placeholder="e.g. ^[0-9]+$"
      />
      <TextInput
        label={t('form_builder.reference')}
        value={typeof field.reference === 'string' ? field.reference : ''}
        onChange={handleReferenceChange}
        placeholder="e.g. 10 – 15"
      />
      <TextInput label={t('form_builder.unit')} value={field.unit ?? ''} onChange={handleUnitChange} />
      <TextInput label={t('form_builder.method')} value={field.method ?? ''} onChange={handleMethodChange} />
    </Stack>
  );
}
