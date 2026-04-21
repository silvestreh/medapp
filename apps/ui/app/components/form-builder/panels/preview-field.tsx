import { useCallback, useMemo } from 'react';
import { Select, Checkbox, ActionIcon, Group, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVerticalIcon, TrashIcon } from '@phosphor-icons/react';
import { styled } from '~/styled-system/jsx';
import { Icd10Selector } from '~/components/icd10-selector';
import { MedicationSelector } from '~/components/medication-selector';
import { useBuilder } from '../builder-context';
import type { AnyField, BuilderField } from '../builder-types';
import { FieldRow, StyledTextInput, StyledTextarea } from '~/components/forms/styles';
import { formatReference, type FieldReference } from '~/components/forms/format-reference';
import { GroupDropZone } from './group-drop-zone';
import { getCheckboxLayout } from '../utils/checkbox-layout';

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

const rowCenterStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', flex: 1 };
const flexOneStyle: React.CSSProperties = { flex: 1 };
const topLabelRowStyle: React.CSSProperties = { flexDirection: 'column', alignItems: 'stretch' };
const topLabelContentStyle: React.CSSProperties = { paddingLeft: 24 };

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

  const field = builderField.field;
  const colSpan = field.colSpan || 1;

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

  if (field.type === 'tri-state-checkbox') {
    const layout = getCheckboxLayout(field, labelPosition);
    return (
      <div ref={setNodeRef} style={style}>
        <FieldWrapper selected={isSelected || undefined} onClick={handleSelect}>
          <FieldRow>
            <div style={rowCenterStyle}>
              <DragHandle {...attributes} {...listeners}>
                <DotsSixVerticalIcon size={16} />
              </DragHandle>

              {layout.showLeftLabel && field.label && <FieldLabel>{field.label}:</FieldLabel>}
              {layout.withSpacer && <FieldLabel />}

              <div style={flexOneStyle}>
                <Checkbox label={layout.labelOnRight ? field.label : undefined} indeterminate />
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

  if (field.type === 'group') {
    return (
      <div ref={setNodeRef} style={style}>
        <FieldWrapper selected={isSelected || undefined} onClick={handleSelect}>
          <FieldRow>
            <DragHandle {...attributes} {...listeners}>
              <DotsSixVerticalIcon size={16} />
            </DragHandle>
            <div style={flexOneStyle}>
              <Checkbox label={field.toggleLabel || field.label || 'Group'} checked={false} readOnly mb="xs" />
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

  const isTopLabel = labelPosition === 'top';
  const hasLabel = Boolean(field.label);
  const showLeftLabel = hasLabel && !isTopLabel;

  return (
    <div ref={setNodeRef} style={style}>
      <FieldWrapper selected={isSelected || undefined} onClick={handleSelect}>
        <FieldRow style={isTopLabel ? topLabelRowStyle : undefined}>
          <div style={rowCenterStyle}>
            <DragHandle {...attributes} {...listeners}>
              <DotsSixVerticalIcon size={16} />
            </DragHandle>

            {isTopLabel && hasLabel && (
              <Text size="sm" fw={500} c="gray.6" mb={4}>
                {field.label}
              </Text>
            )}

            {showLeftLabel && <FieldLabel>{field.label}:</FieldLabel>}

            {!isTopLabel && <div style={flexOneStyle}>{renderFieldPreview(field)}</div>}

            <Group className="field-actions" gap={4} wrap="nowrap">
              <ActionIcon variant="subtle" color="red" size="sm" onClick={handleRemove}>
                <TrashIcon size={14} />
              </ActionIcon>
            </Group>
          </div>

          {isTopLabel && <div style={topLabelContentStyle}>{renderFieldPreview(field)}</div>}
        </FieldRow>
      </FieldWrapper>
    </div>
  );
}

function renderFieldPreview(field: AnyField): React.ReactNode {
  switch (field.type) {
    case 'input':
      return (
        <>
          <StyledTextInput
            placeholder={field.placeholder || 'Text input'}
            type={field.inputType || 'text'}
            rightSection={renderUnitSection(field.unit)}
          />
          {renderReferenceHint(field.reference)}
        </>
      );
    case 'textarea':
      return (
        <>
          <StyledTextarea
            placeholder={field.placeholder || 'Text area'}
            autosize
            minRows={field.minRows || 2}
            rightSection={renderUnitSection(field.unit)}
          />
          {renderReferenceHint(field.reference)}
        </>
      );
    case 'select': {
      const flatOptions = (field.options ?? []).flatMap(o => ('items' in o ? o.items : [o]));
      return (
        <Select
          placeholder="Select an option"
          data={flatOptions.map(o => ({ value: o.value, label: o.label }))}
          clearable={field.clearable}
          variant="unstyled"
        />
      );
    }
    case 'date':
      return <DateInput placeholder={field.valueFormat || 'DD/MM/YYYY'} variant="unstyled" />;
    case 'icd10':
      return (
        <Icd10Selector value={field.multi ? [] : ''} onChange={noop} multiSelect={!!field.multi} variant="unstyled" />
      );
    case 'medication':
      return <MedicationSelector value="" onChange={noop} />;
    case 'separator':
      return <div style={separatorStyle} />;
    case 'tri-state-checkbox':
    case 'group':
    case 'tabs':
      return null; // handled by specialized branches or not placeable from palette
  }
}

const separatorStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--mantine-color-gray-3)',
  margin: '8px 0',
};

function noop() {}

const unitStyle: React.CSSProperties = {
  color: 'var(--mantine-color-gray-6)',
  fontSize: 'var(--mantine-font-size-sm)',
  paddingRight: '4px',
  whiteSpace: 'nowrap',
};

const referenceStyle: React.CSSProperties = {
  color: 'var(--mantine-color-gray-6)',
  fontSize: 'var(--mantine-font-size-xs)',
  marginTop: 2,
  lineHeight: 1.4,
};

function renderUnitSection(unit: string | undefined) {
  return unit ? <span style={unitStyle}>{unit}</span> : null;
}

function renderReferenceHint(reference: FieldReference | undefined) {
  if (!reference) return null;
  const str = formatReference(reference);
  if (!str) return null;
  return <div style={referenceStyle}>Ref: {str}</div>;
}
