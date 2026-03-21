import { useCallback } from 'react';
import { TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

interface PracticeCodeInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function PracticeCodeInput({ value, onChange }: PracticeCodeInputProps) {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.currentTarget.value);
    },
    [onChange]
  );

  return (
    <TextInput
      label={t('accounting.settings_practice_code')}
      value={value}
      onChange={handleChange}
      placeholder={t('accounting.settings_practice_code_placeholder')}
      flex={1}
      styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
    />
  );
}
