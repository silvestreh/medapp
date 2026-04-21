import { useCallback } from 'react';
import { NumberInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CustomFormTextareaField } from '@athelas/encounter-schemas';
import type { UpdateFn } from '../field-properties';

interface Props {
  field: CustomFormTextareaField;
  onUpdate: UpdateFn;
}

export function TextareaProperties({ field, onUpdate }: Props) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (v: number | string) => onUpdate({ minRows: typeof v === 'number' ? v : 2 }),
    [onUpdate]
  );

  return (
    <NumberInput
      label={t('form_builder.min_rows')}
      value={field.minRows ?? 2}
      min={1}
      max={20}
      onChange={handleChange}
    />
  );
}
