import { useCallback, useMemo, useState } from 'react';
import { Button, Group, Badge, Box } from '@mantine/core';
import { DndContext, DragOverlay, pointerWithin, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { FloppyDiskIcon, RocketLaunchIcon } from '@phosphor-icons/react';
import { useNavigate } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';
import { useBuilder } from './builder-context';
import { FieldPalette, PALETTE_BY_TYPE } from './panels/field-palette';
import { FormPreview } from './panels/form-preview';
import { PropertyEditor } from './panels/property-editor';
import { createDefaultField } from './utils/field-defaults';
import { ToolbarTitle } from '~/components/toolbar-title';
import Portal from '~/components/portal';
import type { AnyField } from './builder-types';

interface FormBuilderProps {
  onSave: (status?: 'draft' | 'published') => void;
  isSaving?: boolean;
}

const BuilderLayout = styled('div', {
  base: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    height: 'calc(100vh - 60px)',

    lg: {
      gridTemplateColumns: '260px 1fr 300px',
    },
  },
});

const PaletteWrapper = styled('div', {
  base: {
    display: 'none',

    lg: {
      display: 'block',
      overflow: 'hidden',
    },
  },
});

const PreviewWrapper = styled('div', {
  base: {
    overflow: 'hidden',
  },
});

const PropertiesWrapper = styled('div', {
  base: {
    display: 'none',

    lg: {
      display: 'block',
      overflow: 'hidden',
    },
  },
});

export function FormBuilder({ onSave, isSaving }: FormBuilderProps) {
  const { state, dispatch } = useBuilder();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;

      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Palette → Preview: insert new field
      if (activeData?.source === 'palette') {
        const fieldType = activeData.fieldType;
        const field = createDefaultField(fieldType as any);

        let targetFieldsetId: string | null = null;
        let atIndex: number | undefined;

        if (overData?.type === 'group-drop') {
          dispatch({
            type: 'ADD_FIELD',
            payload: {
              fieldsetId: overData.fieldsetId,
              field,
              groupFieldId: overData.groupFieldId,
            },
          });
          return;
        }

        if (overData?.type === 'fieldset-drop') {
          targetFieldsetId = overData.fieldsetId;
        } else if (overData?.type === 'field' && overData.parentGroupId) {
          // Dropped onto a field inside a group — add to that group
          dispatch({
            type: 'ADD_FIELD',
            payload: {
              fieldsetId: overData.fieldsetId,
              field,
              groupFieldId: overData.parentGroupId,
            },
          });
          return;
        } else if (overData?.type === 'field') {
          targetFieldsetId = overData.fieldsetId;
          const fs = state.fieldsets.find(f => f._id === targetFieldsetId);
          if (fs) {
            atIndex = fs.fields.findIndex(f => f._id === over.id);
          }
        }

        if (!targetFieldsetId) {
          targetFieldsetId = state.fieldsets[state.fieldsets.length - 1]?._id;
        }

        if (targetFieldsetId) {
          dispatch({
            type: 'ADD_FIELD',
            payload: { fieldsetId: targetFieldsetId, field, atIndex },
          });
        }
        return;
      }

      // Field reorder within same fieldset
      if (activeData?.type === 'field' && overData?.type === 'field') {
        const fromFieldsetId = activeData.fieldsetId;
        const toFieldsetId = overData.fieldsetId;

        if (fromFieldsetId === toFieldsetId) {
          dispatch({
            type: 'REORDER_FIELD',
            payload: { fieldsetId: fromFieldsetId, fromId: active.id as string, toId: over.id as string },
          });
        } else {
          // Cross-fieldset field move
          const toFs = state.fieldsets.find(f => f._id === toFieldsetId);
          if (toFs) {
            const toIndex = toFs.fields.findIndex(f => f._id === over.id);
            dispatch({
              type: 'MOVE_FIELD',
              payload: {
                fromFieldsetId,
                fieldId: active.id as string,
                toFieldsetId,
                toIndex: toIndex !== -1 ? toIndex : toFs.fields.length,
              },
            });
          }
        }
        return;
      }

      // Field dropped onto empty fieldset drop zone
      if (activeData?.type === 'field' && overData?.type === 'fieldset-drop') {
        const fromFieldsetId = activeData.fieldsetId;
        const toFieldsetId = overData.fieldsetId;
        if (fromFieldsetId !== toFieldsetId) {
          dispatch({
            type: 'MOVE_FIELD',
            payload: {
              fromFieldsetId,
              fieldId: active.id as string,
              toFieldsetId,
              toIndex: 0,
            },
          });
        }
        return;
      }

      // Fieldset reorder
      if (activeData?.type === 'fieldset' && overData?.type === 'fieldset') {
        const fromIndex = state.fieldsets.findIndex(f => `fieldset-${f._id}` === active.id);
        const toIndex = state.fieldsets.findIndex(f => `fieldset-${f._id}` === over.id);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          dispatch({
            type: 'REORDER_FIELDSET',
            payload: { fromIndex, toIndex },
          });
        }
      }
    },
    [dispatch, state.fieldsets]
  );

  const handleSaveDraft = useCallback(() => {
    onSave('draft');
  }, [onSave]);

  const handlePublish = useCallback(() => {
    onSave('published');
  }, [onSave]);

  const handleBack = useCallback(() => {
    navigate('/forms');
  }, [navigate]);

  return (
    <DndContext collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Portal id="toolbar">
        <ToolbarTitle
          title={state.label || t('form_builder.new_form')}
          subTitle={t(`form_builder.type_${state.type}` as any)}
          onBack={handleBack}
        />
      </Portal>

      <Portal id="form-actions">
        <Group gap="xs">
          <Badge color={state.isDirty ? 'yellow' : 'gray'} variant="light">
            {state.isDirty ? t('form_builder.unsaved') : t('form_builder.saved')}
          </Badge>
          <Box visibleFrom="lg">
            <Button
              variant="light"
              leftSection={<FloppyDiskIcon size={16} />}
              onClick={handleSaveDraft}
              loading={isSaving}
              size="sm"
            >
              {t('form_builder.save_draft')}
            </Button>
          </Box>
          <Button
            leftSection={<RocketLaunchIcon size={16} />}
            onClick={handlePublish}
            loading={isSaving}
            size="sm"
            color="green"
          >
            {t('form_builder.publish')}
          </Button>
        </Group>
      </Portal>

      <BuilderLayout>
        <PaletteWrapper>
          <FieldPalette />
        </PaletteWrapper>

        <PreviewWrapper>
          <FormPreview />
        </PreviewWrapper>

        <PropertiesWrapper>
          <PropertyEditor />
        </PropertiesWrapper>
      </BuilderLayout>

      <DragOverlay>
        {activeDragId?.startsWith('palette-') &&
          (() => {
            const fieldType = activeDragId.replace('palette-', '');
            const def = PALETTE_BY_TYPE[fieldType];
            const Icon = def?.icon;
            return (
              <div
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'white',
                  borderRadius: 'var(--mantine-radius-sm)',
                  boxShadow: 'var(--mantine-shadow-md)',
                  fontSize: 'var(--mantine-font-size-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {Icon && <Icon size={16} />}
                {def ? t(`form_builder.${def.labelKey}` as any) : fieldType}
              </div>
            );
          })()}
      </DragOverlay>
    </DndContext>
  );
}
