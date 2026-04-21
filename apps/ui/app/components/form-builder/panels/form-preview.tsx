import { useMemo, useCallback } from 'react';
import { Stack, TextInput } from '@mantine/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';
import { useBuilder } from '../builder-context';
import { PreviewFieldset } from './preview-fieldset';

const PreviewContainer = styled('div', {
  base: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--mantine-spacing-lg)',
    backgroundColor: 'var(--mantine-color-gray-1)',
    height: '100%',
  },
});

const FormNameInput = styled(TextInput, {
  base: {
    '& input': {
      fontSize: 'var(--mantine-font-size-xl)',
      fontWeight: 700,
      border: 'none',
      borderBottom: '2px solid var(--mantine-color-gray-3)',
      borderRadius: 0,
      padding: 'var(--mantine-spacing-xs) 0',
      backgroundColor: 'transparent',

      '&:focus': {
        borderBottomColor: 'var(--mantine-primary-color-4)',
      },
    },
  },
});

const stackStyle: React.CSSProperties = { maxWidth: 800, margin: '0 auto' };

export function FormPreview() {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();

  const fieldsetIds = useMemo(() => state.fieldsets.map(fs => `fieldset-${fs._id}`), [state.fieldsets]);

  const handleClickBackground = useCallback(() => {
    dispatch({
      type: 'SELECT_FIELD',
      payload: { fieldId: null, fieldsetId: null },
    });
  }, [dispatch]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'SET_META',
        payload: { label: e.target.value, name: e.target.value },
      });
    },
    [dispatch]
  );

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <PreviewContainer onClick={handleClickBackground}>
      <Stack gap="md" style={stackStyle}>
        <FormNameInput
          placeholder={t('form_builder.form_name_placeholder')}
          value={state.label}
          onChange={handleNameChange}
          onClick={stopPropagation}
          variant="unstyled"
        />

        <SortableContext items={fieldsetIds} strategy={verticalListSortingStrategy}>
          {state.fieldsets.map(fs => (
            <PreviewFieldset key={fs._id} fieldset={fs} />
          ))}
        </SortableContext>
      </Stack>
    </PreviewContainer>
  );
}
