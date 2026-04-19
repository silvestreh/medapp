import { useCallback, useMemo } from 'react';
import { Stack, Text, Divider } from '@mantine/core';
import {
  TextTIcon,
  NoteBlankIcon,
  ListBulletsIcon,
  CalendarBlankIcon,
  CheckSquareIcon,
  FirstAidKitIcon,
  PillIcon,
  TextHOneIcon,
  TextAlignLeftIcon,
  MinusIcon,
  TabsIcon,
  SquaresFourIcon,
  ListPlusIcon,
  PlusIcon,
} from '@phosphor-icons/react';
import { useDraggable } from '@dnd-kit/core';
import { styled } from '~/styled-system/jsx';
import { useTranslation } from 'react-i18next';
import { useBuilder } from '../builder-context';
import { createDefaultField } from '../utils/field-defaults';
import { findFieldRecursive } from '../builder-reducer';
import type { AnyField } from '../builder-types';

interface PaletteFieldDef {
  type: string;
  labelKey: string;
  icon: React.ElementType;
  category: 'input' | 'structural';
}

const INPUT_FIELDS: PaletteFieldDef[] = [
  { type: 'input', labelKey: 'palette_input', icon: TextTIcon, category: 'input' },
  { type: 'textarea', labelKey: 'palette_textarea', icon: NoteBlankIcon, category: 'input' },
  { type: 'select', labelKey: 'palette_select', icon: ListBulletsIcon, category: 'input' },
  { type: 'date', labelKey: 'palette_date', icon: CalendarBlankIcon, category: 'input' },
  { type: 'tri-state-checkbox', labelKey: 'palette_checkbox', icon: CheckSquareIcon, category: 'input' },
  { type: 'icd10', labelKey: 'palette_icd10', icon: FirstAidKitIcon, category: 'input' },
  { type: 'medication', labelKey: 'palette_medication', icon: PillIcon, category: 'input' },
];

const STRUCTURAL_FIELDS: PaletteFieldDef[] = [
  { type: 'separator', labelKey: 'palette_separator', icon: MinusIcon, category: 'structural' },
  { type: 'group', labelKey: 'palette_group', icon: SquaresFourIcon, category: 'structural' },
];

const ALL_PALETTE_FIELDS: PaletteFieldDef[] = [...INPUT_FIELDS, ...STRUCTURAL_FIELDS];

const PALETTE_BY_TYPE: Record<string, PaletteFieldDef> = {};
for (const def of ALL_PALETTE_FIELDS) {
  if (!PALETTE_BY_TYPE[def.type]) {
    PALETTE_BY_TYPE[def.type] = def;
  }
}

export { PALETTE_BY_TYPE };

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

function DraggablePaletteItem({ def }: { def: PaletteFieldDef }) {
  const { dispatch, state } = useBuilder();
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${def.type}`,
    data: { source: 'palette', fieldType: def.type },
  });

  const handleClick = useCallback(() => {
    const field = createDefaultField(def.type as any);
    const targetFieldsetId = state.selectedFieldsetId || state.fieldsets[state.fieldsets.length - 1]?._id;
    if (!targetFieldsetId) return;

    // If a group field is selected, add inside the group
    if (state.selectedFieldId) {
      const fs = state.fieldsets.find(f => f._id === targetFieldsetId);
      const selectedBf = fs ? findFieldRecursive(fs.fields, state.selectedFieldId) : null;
      if (selectedBf && selectedBf.field.type === 'group') {
        dispatch({
          type: 'ADD_FIELD',
          payload: { fieldsetId: targetFieldsetId, field, groupFieldId: state.selectedFieldId },
        });
        return;
      }
    }

    dispatch({ type: 'ADD_FIELD', payload: { fieldsetId: targetFieldsetId, field } });
  }, [dispatch, def.type, state.selectedFieldsetId, state.selectedFieldId, state.fieldsets]);

  const Icon = def.icon;

  return (
    <PaletteItem
      ref={setNodeRef}
      onClick={handleClick}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      {...listeners}
      {...attributes}
    >
      <Icon size={16} />
      <span>{t(`form_builder.${def.labelKey}` as any)}</span>
    </PaletteItem>
  );
}

export function FieldPalette() {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();
  const structuralFields = STRUCTURAL_FIELDS;

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
        {INPUT_FIELDS.map(def => (
          <DraggablePaletteItem key={def.type} def={def} />
        ))}
      </Stack>

      <Divider my="sm" />

      <Text size="xs" fw={700} c="gray.5" tt="uppercase" mb="xs">
        {t('form_builder.structure')}
      </Text>
      <Stack gap={2}>
        {structuralFields.map(def => (
          <DraggablePaletteItem key={def.type} def={def} />
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
