import { useCallback } from 'react';
import { TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CustomFormGroupField } from '@athelas/encounter-schemas';
import type { UpdateFn } from '../field-properties';

interface Props {
  field: CustomFormGroupField;
  onUpdate: UpdateFn;
}

export function GroupProperties({ field, onUpdate }: Props) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ toggleLabel: e.target.value }),
    [onUpdate]
  );

  return (
    <TextInput
      label={t('form_builder.toggle_label')}
      description={t('form_builder.toggle_label_description')}
      value={field.toggleLabel ?? ''}
      onChange={handleChange}
    />
  );
}
