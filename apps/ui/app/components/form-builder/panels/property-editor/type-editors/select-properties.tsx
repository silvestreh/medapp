import { useCallback } from 'react';
import { Button, Stack, Switch, Text } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { CustomFormSelectField, SelectOption } from '@athelas/encounter-schemas';
import type { UpdateFn } from '../field-properties';
import { SelectOptionRow } from './select-option-row';

interface Props {
  field: CustomFormSelectField;
  onUpdate: UpdateFn;
}

function flatten(options: CustomFormSelectField['options']): SelectOption[] {
  return options.flatMap(o => ('items' in o ? o.items : [o]));
}

export function SelectProperties({ field, onUpdate }: Props) {
  const { t } = useTranslation();
  const options = flatten(field.options ?? []);

  const handleClearableChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ clearable: e.target.checked }),
    [onUpdate]
  );

  const handleAddOption = useCallback(() => {
    onUpdate({
      options: [...options, { value: `option${options.length + 1}`, label: `Option ${options.length + 1}` }],
    });
  }, [options, onUpdate]);

  const handleOptionChange = useCallback(
    (index: number, key: 'value' | 'label', val: string) => {
      const next = options.map((o, i) => (i === index ? { ...o, [key]: val } : o));
      onUpdate({ options: next });
    },
    [options, onUpdate]
  );

  const handleRemoveOption = useCallback(
    (index: number) => {
      onUpdate({ options: options.filter((_, i) => i !== index) });
    },
    [options, onUpdate]
  );

  return (
    <Stack gap="xs">
      <Switch label={t('form_builder.clearable')} checked={!!field.clearable} onChange={handleClearableChange} />
      <Text size="sm" fw={600}>
        {t('form_builder.options')}
      </Text>
      {options.map((opt, index) => (
        <SelectOptionRow
          key={index}
          index={index}
          option={opt}
          onChange={handleOptionChange}
          onRemove={handleRemoveOption}
        />
      ))}
      <Button variant="light" size="xs" leftSection={<PlusIcon size={12} />} onClick={handleAddOption}>
        {t('form_builder.add_option')}
      </Button>
    </Stack>
  );
}
