import { useCallback, useMemo } from 'react';
import { Stack, Text, Divider } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { useDraggable } from '@dnd-kit/core';
import { styled } from '~/styled-system/jsx';
import { useTranslation } from 'react-i18next';
import { useBuilder } from '../builder-context';
import { createDefaultField, type CreatableFieldType } from '../utils/field-defaults';
import { findFieldRecursive } from '../builder-reducer';
import { FIELD_METADATA, INPUT_FIELD_TYPES, STRUCTURAL_FIELD_TYPES } from '../field-registry';

const PaletteContainer = styled('div', {
  base: {
    borderRight: '1px solid var(--mantine-color-gray-2)',
    backgroundColor: 'var(--mantine-color-gray-0)',
    overflowY: 'auto',
    padding: 'var(--mantine-spacing-md)',
    height: '100%',
  },
});

const PaletteItem = styled('button', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--mantine-spacing-sm)',
    padding: 'var(--mantine-spacing-xs) var(--mantine-spacing-sm)',
    borderRadius: 'var(--mantine-radius-sm)',
    fontSize: 'var(--mantine-font-size-sm)',
    color: 'var(--mantine-color-gray-7)',
    width: '100%',
    cursor: 'grab',
    transition: 'background-color 150ms ease',
    border: 'none',
    background: 'none',
    textAlign: 'left',

    '&:hover': {
      backgroundColor: 'var(--mantine-color-gray-2)',
    },
  },
});

function DraggablePaletteItem({ fieldType }: { fieldType: CreatableFieldType }) {
  const { dispatch, state } = useBuilder();
  const { t } = useTranslation();
  const meta = FIELD_METADATA[fieldType];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${fieldType}`,
    data: { source: 'palette', fieldType },
  });

  const handleClick = useCallback(() => {
    const field = createDefaultField(fieldType, state.fieldsets);
    const targetFieldsetId = state.selectedFieldsetId || state.fieldsets[state.fieldsets.length - 1]?._id;
    if (!targetFieldsetId) return;

    if (state.selectedFieldId) {
      const fs = state.fieldsets.find(f => f._id === targetFieldsetId);
      const selectedBf = fs ? findFieldRecursive(fs.fields, state.selectedFieldId) : null;
      if (selectedBf?.field.type === 'group') {
        dispatch({
          type: 'ADD_FIELD',
          payload: { fieldsetId: targetFieldsetId, field, groupFieldId: state.selectedFieldId },
        });
        return;
      }
    }

    dispatch({ type: 'ADD_FIELD', payload: { fieldsetId: targetFieldsetId, field } });
  }, [dispatch, fieldType, state.selectedFieldsetId, state.selectedFieldId, state.fieldsets]);

  const Icon = meta.icon;
  const draggingStyle = useMemo(() => ({ opacity: isDragging ? 0.5 : 1 }), [isDragging]);

  return (
    <PaletteItem ref={setNodeRef} onClick={handleClick} style={draggingStyle} {...listeners} {...attributes}>
      <Icon size={16} />
      <span>{t(`form_builder.${meta.labelKey}`)}</span>
    </PaletteItem>
  );
}

export function FieldPalette() {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();

  const handleAddFieldset = useCallback(() => {
    const selectedIdx = state.fieldsets.findIndex(fs => fs._id === state.selectedFieldsetId);
    dispatch({
      type: 'ADD_FIELDSET',
      payload: { afterIndex: selectedIdx >= 0 ? selectedIdx : undefined },
    });
  }, [dispatch, state.fieldsets, state.selectedFieldsetId]);

  return (
    <PaletteContainer>
      <Text size="xs" fw={700} c="gray.5" tt="uppercase" mb="xs">
        {t('form_builder.fields')}
      </Text>
      <Stack gap={2}>
        {INPUT_FIELD_TYPES.map(type => (
          <DraggablePaletteItem key={type} fieldType={type} />
        ))}
      </Stack>

      <Divider my="sm" />

      <Text size="xs" fw={700} c="gray.5" tt="uppercase" mb="xs">
        {t('form_builder.structure')}
      </Text>
      <Stack gap={2}>
        {STRUCTURAL_FIELD_TYPES.map(type => (
          <DraggablePaletteItem key={type} fieldType={type} />
        ))}
      </Stack>

      <Divider my="sm" />

      <PaletteItem onClick={handleAddFieldset}>
        <PlusIcon size={16} />
        <span>{t('form_builder.add_fieldset')}</span>
      </PaletteItem>
    </PaletteContainer>
  );
}
