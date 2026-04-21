import { useCallback } from 'react';
import { TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CustomFormDateField } from '@athelas/encounter-schemas';
import type { UpdateFn } from '../field-properties';

interface Props {
  field: CustomFormDateField;
  onUpdate: UpdateFn;
}

export function DateProperties({ field, onUpdate }: Props) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ valueFormat: e.target.value }),
    [onUpdate]
  );

  return (
    <TextInput
      label={t('form_builder.value_format')}
      value={field.valueFormat ?? 'DD/MM/YYYY'}
      onChange={handleChange}
    />
  );
}
