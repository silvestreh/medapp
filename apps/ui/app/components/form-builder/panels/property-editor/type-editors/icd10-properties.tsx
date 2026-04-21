import { useCallback } from 'react';
import { Switch } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CustomFormIcd10Field } from '@athelas/encounter-schemas';
import type { UpdateFn } from '../field-properties';

interface Props {
  field: CustomFormIcd10Field;
  onUpdate: UpdateFn;
}

export function Icd10Properties({ field, onUpdate }: Props) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ multi: e.target.checked }),
    [onUpdate]
  );

  return <Switch label={t('form_builder.multi_selection')} checked={!!field.multi} onChange={handleChange} />;
}
