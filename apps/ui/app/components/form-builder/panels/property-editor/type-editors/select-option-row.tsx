import { useCallback } from 'react';
import { ActionIcon, Group, TextInput } from '@mantine/core';
import { TrashIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { SelectOption } from '@athelas/encounter-schemas';
import { flexOneStyle } from '../styles';

interface Props {
  index: number;
  option: SelectOption;
  onChange: (index: number, key: 'value' | 'label', val: string) => void;
  onRemove: (index: number) => void;
}

export function SelectOptionRow({ index, option, onChange, onRemove }: Props) {
  const { t } = useTranslation();

  const handleValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(index, 'value', e.target.value),
    [index, onChange]
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(index, 'label', e.target.value),
    [index, onChange]
  );

  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput placeholder="Value" value={option.value} onChange={handleValueChange} size="xs" style={flexOneStyle} />
      <TextInput
        placeholder={t('form_builder.field_label')}
        value={option.label}
        onChange={handleLabelChange}
        size="xs"
        style={flexOneStyle}
      />
      <ActionIcon size="sm" variant="subtle" color="red" onClick={handleRemove}>
        <TrashIcon size={12} />
      </ActionIcon>
    </Group>
  );
}
