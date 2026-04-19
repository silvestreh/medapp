import { useCallback, useMemo } from 'react';
import { ActionIcon, Button, Group, Tabs, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVerticalIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { styled } from '~/styled-system/jsx';
import { useBuilder } from '../builder-context';
import type { BuilderFieldset } from '../builder-types';
import { PreviewField } from './preview-field';
import { FormCard } from '~/components/forms/styles';

interface PreviewFieldsetProps {
  fieldset: BuilderFieldset;
  index: number;
}

const FieldsetHeader = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--mantine-spacing-xs)',
    padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    backgroundColor: 'var(--mantine-color-gray-0)',
    borderTopLeftRadius: 'var(--mantine-radius-md)',
    borderTopRightRadius: 'var(--mantine-radius-md)',
    minHeight: '44px',
  },
});

const FieldsetDragHandle = styled('div', {
  base: {
    cursor: 'grab',
    color: 'var(--mantine-color-gray-4)',
    display: 'flex',
    alignItems: 'center',

    '&:hover': {
      color: 'var(--mantine-color-gray-6)',
    },
  },
});

const EmptyDropZone = styled('div', {
  base: {
    padding: 'var(--mantine-spacing-xl)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--mantine-color-gray-4)',
    fontSize: 'var(--mantine-font-size-sm)',
    borderStyle: 'dashed',
    borderWidth: '2px',
    borderColor: 'var(--mantine-color-gray-3)',
    borderRadius: 'var(--mantine-radius-sm)',
    margin: 'var(--mantine-spacing-sm)',
    transition: 'border-color 200ms ease, background-color 200ms ease',
  },
});

const FieldsContainer = styled('div', {
  base: {
    '& > div + div': {
      borderTop: '1px solid var(--mantine-color-gray-2)',
    },
  },
  variants: {
    grid: {
      true: {
        '& > div + div': {
          borderTop: 'none',
        },

        '& > hr': {
          gridColumn: '1 / -1',
          border: 'none',
          borderTop: '1px solid var(--mantine-color-gray-2)',
          margin: 0,
        },
      },
    },
  },
});

function renderFieldsWithSeparators(
  fields: BuilderFieldset['fields'],
  columns: number,
  fieldsetId: string,
  labelPosition: BuilderFieldset['labelPosition']
) {
  if (columns <= 1) {
    return fields.map(bf => (
      <PreviewField
        key={bf._id}
        builderField={bf}
        fieldsetId={fieldsetId}
        labelPosition={labelPosition}
        columns={columns}
      />
    ));
  }

  // Insert <hr> separators between grid rows
  const elements: React.ReactNode[] = [];
  let colsUsed = 0;

  for (const bf of fields) {
    const span = Math.min((bf.field as any).colSpan || 1, columns);
    if (colsUsed + span > columns && colsUsed > 0) {
      elements.push(<hr key={`sep-${bf._id}`} />);
      colsUsed = 0;
    }
    elements.push(
      <PreviewField
        key={bf._id}
        builderField={bf}
        fieldsetId={fieldsetId}
        labelPosition={labelPosition}
        columns={columns}
      />
    );
    colsUsed += span;
  }

  return elements;
}

export function PreviewFieldset({ fieldset, index }: PreviewFieldsetProps) {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();
  const isSelected = state.selectedFieldsetId === fieldset._id && !state.selectedFieldId;
  const columns = fieldset.columns || 1;

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `fieldset-${fieldset._id}`,
    data: { type: 'fieldset', fieldsetId: fieldset._id },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `fieldset-drop-${fieldset._id}`,
    data: { type: 'fieldset-drop', fieldsetId: fieldset._id },
  });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
    }),
    [transform, transition, isDragging]
  );

  const fieldIds = useMemo(() => fieldset.fields.map(f => f._id), [fieldset.fields]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'UPDATE_FIELDSET',
        payload: { fieldsetId: fieldset._id, title: e.target.value },
      });
    },
    [dispatch, fieldset._id]
  );

  const handleRemove = useCallback(() => {
    dispatch({
      type: 'REMOVE_FIELDSET',
      payload: { fieldsetId: fieldset._id },
    });
  }, [dispatch, fieldset._id]);

  const handleSelectFieldset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch({
        type: 'SELECT_FIELD',
        payload: { fieldId: null, fieldsetId: fieldset._id },
      });
    },
    [dispatch, fieldset._id]
  );

  return (
    <div ref={setSortableRef} style={style}>
      <FormCard
        style={{
          outline: isSelected ? '2px solid var(--mantine-primary-color-4)' : undefined,
        }}
      >
        <FieldsetHeader onClick={handleSelectFieldset}>
          <FieldsetDragHandle {...attributes} {...listeners}>
            <DotsSixVerticalIcon size={18} />
          </FieldsetDragHandle>

          <TextInput
            variant="unstyled"
            placeholder={t('form_builder.fieldset_title_placeholder')}
            value={fieldset.title || ''}
            onChange={handleTitleChange}
            size="sm"
            fw={600}
            style={{ flex: 1 }}
            onClick={e => {
              e.stopPropagation();
              dispatch({
                type: 'SELECT_FIELD',
                payload: { fieldId: null, fieldsetId: fieldset._id },
              });
            }}
          />

          {fieldset.repeatable && (
            <Text size="xs" c="violet" fw={600}>
              {t('form_builder.repeatable')}
            </Text>
          )}

          {fieldset.extraCost && (
            <Text size="xs" c="orange" fw={600}>
              {t('form_builder.extra_cost')}
            </Text>
          )}

          <Group gap={4}>
            {state.fieldsets.length > 1 && (
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <TrashIcon size={14} />
              </ActionIcon>
            )}
          </Group>
        </FieldsetHeader>

        {fieldset.tabs ? (
          <div onClick={handleSelectFieldset}>
            <Tabs
              value={fieldset.activeTabId || fieldset.tabs[0]?._id}
              onChange={tabId => {
                if (tabId) dispatch({ type: 'SET_ACTIVE_TAB', payload: { fieldsetId: fieldset._id, tabId } });
              }}
              variant={fieldset.tabStyle ?? 'pills'}
            >
              <Tabs.List grow mb="md" mx="md" mt="sm">
                {fieldset.tabs.map(tab => (
                  <Tabs.Tab key={tab._id} value={tab._id}>
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>

              {fieldset.tabs.map(tab => {
                const tabFieldIds = tab.fields.map(f => f._id);
                return (
                  <Tabs.Panel key={tab._id} value={tab._id}>
                    <FieldsContainer
                      grid={columns > 1 || undefined}
                      ref={tab._id === (fieldset.activeTabId || fieldset.tabs![0]?._id) ? setDroppableRef : undefined}
                      style={
                        columns > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined
                      }
                    >
                      <SortableContext
                        items={tabFieldIds}
                        strategy={columns > 1 ? rectSortingStrategy : verticalListSortingStrategy}
                      >
                        {renderFieldsWithSeparators(tab.fields, columns, fieldset._id, fieldset.labelPosition)}
                      </SortableContext>

                      {tab.fields.length === 0 && (
                        <EmptyDropZone
                          style={{
                            borderColor: isOver ? 'var(--mantine-primary-color-4)' : undefined,
                            backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : undefined,
                          }}
                        >
                          {t('form_builder.drop_fields_here')}
                        </EmptyDropZone>
                      )}
                    </FieldsContainer>
                  </Tabs.Panel>
                );
              })}
            </Tabs>
          </div>
        ) : (
          <FieldsContainer
            grid={columns > 1 || undefined}
            ref={setDroppableRef}
            onClick={handleSelectFieldset}
            style={
              columns > 1
                ? {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  }
                : undefined
            }
          >
            <SortableContext
              items={fieldIds}
              strategy={columns > 1 ? rectSortingStrategy : verticalListSortingStrategy}
            >
              {renderFieldsWithSeparators(fieldset.fields, columns, fieldset._id, fieldset.labelPosition)}
            </SortableContext>

            {fieldset.fields.length === 0 && (
              <EmptyDropZone
                style={{
                  borderColor: isOver ? 'var(--mantine-primary-color-4)' : undefined,
                  backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : undefined,
                }}
              >
                {t('form_builder.drop_fields_here')}
              </EmptyDropZone>
            )}
          </FieldsContainer>
        )}

        {fieldset.repeatable && fieldset.fields.length > 0 && (
          <Group justify="flex-end" p="sm">
            <Button variant="light" size="xs" leftSection={<PlusIcon size={14} />} disabled>
              {fieldset.addLabel || t('form_builder.add_item_default')}
            </Button>
          </Group>
        )}
      </FormCard>
    </div>
  );
}
