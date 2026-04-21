import { useCallback } from 'react';
import { SegmentedControl, Stack, Switch, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CustomFormCheckboxField } from '@athelas/encounter-schemas';
import type { UpdateFn } from '../field-properties';

interface Props {
  field: CustomFormCheckboxField;
  onUpdate: UpdateFn;
}

export function CheckboxProperties({ field, onUpdate }: Props) {
  const { t } = useTranslation();

  const handleVariantChange = useCallback(
    (v: string) => onUpdate({ variant: v === 'checkbox' ? 'checkbox' : undefined }),
    [onUpdate]
  );

  const handleIndentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ indent: e.target.checked }),
    [onUpdate]
  );

  return (
    <Stack gap="xs">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {t('form_builder.checkbox_label_position')}
        </Text>
        <SegmentedControl
          data={[
            { value: 'default', label: t('form_builder.checkbox_label_left') },
            { value: 'checkbox', label: t('form_builder.checkbox_label_right') },
          ]}
          value={field.variant === 'checkbox' ? 'checkbox' : 'default'}
          onChange={handleVariantChange}
          fullWidth
          size="xs"
        />
      </Stack>
      {field.variant === 'checkbox' && (
        <Switch
          label={t('form_builder.checkbox_spacer')}
          description={t('form_builder.checkbox_spacer_description')}
          checked={!!field.indent}
          onChange={handleIndentChange}
        />
      )}
    </Stack>
  );
}
