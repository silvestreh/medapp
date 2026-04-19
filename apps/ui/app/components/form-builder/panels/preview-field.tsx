import { useCallback, useMemo } from 'react';
import { Select, Checkbox, ActionIcon, Group, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVerticalIcon, TrashIcon } from '@phosphor-icons/react';
import { styled } from '~/styled-system/jsx';
import { Icd10Selector } from '~/components/icd10-selector';
import { MedicationSelector } from '~/components/medication-selector';
import { useBuilder } from '../builder-context';
import type { BuilderField } from '../builder-types';
import { FieldRow, StyledTextInput, StyledTextarea } from '~/components/forms/styles';

const FieldLabel = styled('div', {
  base: {
    flex: 'none',
    width: '25%',
    textAlign: 'right',
    paddingRight: 'var(--mantine-spacing-sm)',
    color: 'var(--mantine-color-gray-6)',
    fontSize: 'var(--mantine-font-size-sm)',
  },
});

interface PreviewFieldProps {
  builderField: BuilderField;
  fieldsetId: string;
  labelPosition?: 'left' | 'top';
  columns?: number;
  parentGroupId?: string;
}

const FieldWrapper = styled('div', {
  base: {
    position: 'relative',
    cursor: 'pointer',
    borderRadius: 'var(--mantine-radius-sm)',
    transition: 'box-shadow 150ms ease, background-color 150ms ease',

    '&:hover': {
      boxShadow: 'inset 0 0 0 2px var(--mantine-color-blue-2)',
    },

    '& .field-actions': {
      opacity: 0,
      transition: 'opacity 150ms ease',
    },

    '&:hover .field-actions': {
      opacity: 1,
    },
  },

  variants: {
    selected: {
      true: {
        boxShadow: 'inset 0 0 0 2px var(--mantine-primary-color-4)',
        backgroundColor: 'var(--mantine-color-blue-0)',

        '&:hover': {
          boxShadow: 'inset 0 0 0 2px var(--mantine-primary-color-4)',
        },

        '& .field-actions': {
          opacity: 1,
        },
      },
    },
  },
});

const DragHandle = styled('div', {
  base: {
    cursor: 'grab',
    color: 'var(--mantine-color-gray-6)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 4px',

    '&:hover': {
      color: 'var(--mantine-color-gray-7)',
    },
  },
});

export function PreviewField({
  builderField,
  fieldsetId,
  labelPosition = 'left',
  columns = 1,
  parentGroupId,
}: PreviewFieldProps) {
  const { state, dispatch } = useBuilder();
  const isSelected = state.selectedFieldId === builderField._id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: builderField._id,
    data: { type: 'field', fieldsetId, parentGroupId },
  });

  const colSpan = (builderField.field as any).colSpan || 1;

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.4 : 1,
      ...(columns > 1 ? { gridColumn: `span ${Math.min(colSpan, columns)}` } : {}),
    }),
    [transform, transition, isDragging, columns, colSpan]
  );

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch({
        type: 'SELECT_FIELD',
        payload: { fieldId: builderField._id, fieldsetId },
      });
    },
    [dispatch, builderField._id, fieldsetId]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch({
        type: 'REMOVE_FIELD',
        payload: { fieldsetId, fieldId: builderField._id },
      });
    },
    [dispatch, fieldsetId, builderField._id]
  );

  const field = builderField.field;

  const isCheckbox = field.type === 'tri-state-checkbox';
  const isTopLabel = labelPosition === 'top' && !isCheckbox;
  const hasLabel = 'label' in field && field.label;
  const showLeftLabel = hasLabel && !isCheckbox && !isTopLabel;
  // For checkboxes: label-left means "Label: []", label-right means "[] Label"
  // When section labels are on top, checkbox label always goes right (no spacer)
  const sectionIsTop = labelPosition === 'top';
  const checkboxLabelOnRight = isCheckbox && (sectionIsTop || (field as any).variant === 'checkbox');
  const checkboxWithSpacer = isCheckbox && !sectionIsTop && checkboxLabelOnRight && (field as any).indent;

  // Checkboxes get special rendering: label left = "Label: []", label right = "[] Label"
  if (isCheckbox) {
    return (
      <div ref={setNodeRef} style={style}>
        <FieldWrapper selected={isSelected || undefined} onClick={handleSelect}>
          <FieldRow>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <DragHandle {...attributes} {...listeners}>
                <DotsSixVerticalIcon size={16} />
              </DragHandle>

              {!checkboxLabelOnRight && hasLabel && <FieldLabel>{(field as any).label}:</FieldLabel>}

              {checkboxWithSpacer && <FieldLabel />}

              <div style={{ flex: 1 }}>
                <Checkbox label={checkboxLabelOnRight ? (field as any).label : undefined} indeterminate />
              </div>

              <Group className="field-actions" gap={4} wrap="nowrap">
                <ActionIcon variant="subtle" color="red" size="sm" onClick={handleRemove}>
                  <TrashIcon size={14} />
                </ActionIcon>
              </Group>
            </div>
          </FieldRow>
        </FieldWrapper>
      </div>
    );
  }

  // Groups get their own rendering with a droppable zone
  if (field.type === 'group') {
    return (
      <div ref={setNodeRef} style={style}>
        <FieldWrapper selected={isSelected || undefined} onClick={handleSelect}>
          <FieldRow>
            <DragHandle {...attributes} {...listeners}>
              <DotsSixVerticalIcon size={16} />
            </DragHandle>
            <div style={{ flex: 1 }}>
              <Checkbox
                label={(field as any).toggleLabel || (field as any).label || 'Group'}
                checked={false}
                readOnly
                mb="xs"
              />
              <GroupDropZone fieldId={builderField._id} fieldsetId={fieldsetId} builderField={builderField} />
            </div>
            <Group className="field-actions" gap={4} wrap="nowrap">
              <ActionIcon variant="subtle" color="red" size="sm" onClick={handleRemove}>
                <TrashIcon size={14} />
              </ActionIcon>
            </Group>
          </FieldRow>
        </FieldWrapper>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style}>
      <FieldWrapper selected={isSelected || undefined} onClick={handleSelect}>
        <FieldRow style={isTopLabel ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <DragHandle {...attributes} {...listeners}>
              <DotsSixVerticalIcon size={16} />
            </DragHandle>

            {isTopLabel && hasLabel && (
              <Text size="sm" fw={500} c="gray.6" mb={4}>
                {(field as any).label}
              </Text>
            )}

            {showLeftLabel && <FieldLabel>{(field as any).label}:</FieldLabel>}

            {!isTopLabel && <div style={{ flex: 1 }}>{renderFieldPreview(field)}</div>}

            <Group className="field-actions" gap={4} wrap="nowrap">
              <ActionIcon variant="subtle" color="red" size="sm" onClick={handleRemove}>
                <TrashIcon size={14} />
              </ActionIcon>
            </Group>
          </div>

          {isTopLabel && <div style={{ paddingLeft: 24 }}>{renderFieldPreview(field)}</div>}
        </FieldRow>
      </FieldWrapper>
    </div>
  );
}

function renderFieldPreview(field: any) {
  switch (field.type) {
    case 'input':
      return <StyledTextInput placeholder={field.placeholder || 'Text input'} type={field.inputType || 'text'} />;
    case 'textarea':
      return <StyledTextarea placeholder={field.placeholder || 'Text area'} autosize minRows={field.minRows || 2} />;
    case 'select':
      return (
        <Select
          placeholder="Select an option"
          data={
            field.options?.map((o: any) => ({
              value: o.value,
              label: o.label,
            })) || []
          }
          clearable={field.clearable}
          variant="unstyled"
        />
      );
    case 'date':
      return <DateInput placeholder={field.valueFormat || 'DD/MM/YYYY'} variant="unstyled" />;
    case 'tri-state-checkbox':
      return null; // Handled separately in PreviewField render
    case 'icd10':
      return (
        <Icd10Selector
          value={field.multi ? [] : ''}
          onChange={() => {}}
          multiSelect={!!field.multi}
          variant="unstyled"
        />
      );
    case 'medication':
      return <MedicationSelector value="" onChange={() => {}} />;
    case 'title':
      return (
        <div
          style={{
            fontWeight: 600,
            color: 'var(--mantine-color-blue-4)',
            fontSize: 'var(--mantine-font-size-lg)',
          }}
        >
          {field.label || 'Section Title'}
        </div>
      );
    case 'text':
      return (
        <div style={{ color: 'var(--mantine-color-gray-6)', fontSize: 'var(--mantine-font-size-sm)' }}>
          {field.label || 'Description text'}
        </div>
      );
    case 'separator':
      return <div style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', margin: '8px 0' }} />;
    case 'tabs':
      return (
        <div
          style={{
            padding: '8px',
            border: '1px dashed var(--mantine-color-gray-4)',
            borderRadius: 'var(--mantine-radius-sm)',
            color: 'var(--mantine-color-gray-5)',
            fontSize: 'var(--mantine-font-size-sm)',
          }}
        >
          Tabs ({field.tabs?.length || 0} tabs)
        </div>
      );
    case 'group':
      return null; // Rendered by GroupFieldPreview below
    case 'array':
      return (
        <div
          style={{
            padding: '8px',
            border: '1px dashed var(--mantine-color-gray-4)',
            borderRadius: 'var(--mantine-radius-sm)',
            color: 'var(--mantine-color-gray-5)',
            fontSize: 'var(--mantine-font-size-sm)',
          }}
        >
          Repeater: {field.itemLabel || 'Item'} ({field.itemFields?.length || 0} fields)
        </div>
      );
    case 'title-input':
      return (
        <div
          style={{
            fontWeight: 600,
            color: 'var(--mantine-color-blue-4)',
            fontSize: 'var(--mantine-font-size-md)',
          }}
        >
          {field.label || 'Title + Input'}
        </div>
      );
    default:
      return <StyledTextInput placeholder={`Unknown type: ${field.type}`} />;
  }
}

function GroupDropZone({
  fieldId,
  fieldsetId,
  builderField,
}: {
  fieldId: string;
  fieldsetId: string;
  builderField: BuilderField;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-drop-${fieldId}`,
    data: { type: 'group-drop', fieldsetId, groupFieldId: fieldId },
  });

  const children = builderField._groupChildren || [];

  return (
    <div
      style={{
        marginLeft: '24px',
        borderLeft: '2px solid var(--mantine-color-gray-3)',
        backgroundColor: 'var(--mantine-color-gray-0)',
        borderRadius: '0 var(--mantine-radius-sm) var(--mantine-radius-sm) 0',
        minHeight: '40px',
      }}
    >
      {children.map(child => (
        <PreviewField key={child._id} builderField={child} fieldsetId={fieldsetId} parentGroupId={fieldId} />
      ))}
      <div
        ref={setNodeRef}
        style={{
          padding: children.length > 0 ? '8px 12px' : '16px',
          backgroundColor: isOver ? 'var(--mantine-color-blue-0)' : 'transparent',
          borderRadius: 'var(--mantine-radius-sm)',
          transition: 'background-color 200ms ease',
          textAlign: 'center',
        }}
      >
        <Text size="xs" c="gray.4">
          {children.length === 0 ? 'Drop fields here' : '+'}
        </Text>
      </div>
    </div>
  );
}
