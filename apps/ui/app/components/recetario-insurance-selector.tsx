import { useCallback, useMemo } from 'react';
import { Autocomplete } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { RecetarioInsurance } from '~/utils/match-insurance';

interface RecetarioInsuranceSelectorProps {
  insurances: RecetarioInsurance[];
  value: string;
  onChange: (name: string) => void;
  onSelect: (name: string) => void;
  label?: string;
  error?: string;
}

export function RecetarioInsuranceSelector({
  insurances,
  value,
  onChange,
  onSelect,
  label,
  error,
}: RecetarioInsuranceSelectorProps) {
  const { t } = useTranslation();

  const data = useMemo(
    () => insurances.map(i => i.name),
    [insurances]
  );

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  const handleOptionSubmit = useCallback(
    (val: string) => {
      onSelect(val);
    },
    [onSelect]
  );

  return (
    <Autocomplete
      label={label ?? t('recetario.health_insurance_name')}
      placeholder={t('common.search')}
      data={data}
      value={value}
      onChange={handleChange}
      onOptionSubmit={handleOptionSubmit}
      error={error}
      limit={20}
      mt="xs"
    />
  );
}
