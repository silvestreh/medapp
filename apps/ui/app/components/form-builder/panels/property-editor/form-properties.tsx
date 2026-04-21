import { useCallback } from 'react';
import { Stack, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useBuilder } from '../../builder-context';
import { SectionTitle } from './styles';

export function FormProperties() {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_META', payload: { name: e.target.value } });
    },
    [dispatch]
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_META', payload: { label: e.target.value } });
    },
    [dispatch]
  );

  return (
    <Stack gap="sm">
      <SectionTitle>{t('form_builder.form_properties')}</SectionTitle>
      <TextInput
        label={t('form_builder.internal_name')}
        description={t('form_builder.internal_name_description')}
        value={state.name}
        onChange={handleNameChange}
      />
      <TextInput
        label={t('form_builder.display_name')}
        description={t('form_builder.display_name_description')}
        value={state.label}
        onChange={handleLabelChange}
      />
      <Text size="xs" c="dimmed">
        {t('form_builder.field_type')}:{' '}
        {t(state.type === 'study' ? 'form_builder.type_study' : 'form_builder.type_encounter')}
      </Text>
    </Stack>
  );
}
