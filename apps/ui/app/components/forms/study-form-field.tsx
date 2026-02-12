import { useState, useCallback } from 'react';
import { Text, Group, Stack } from '@mantine/core';
import { styled } from '~/styled-system/jsx';
import {
  FieldRow,
  Label,
  StyledTextInput,
  StyledTextarea,
  StyledSelect,
  StyledTitle,
} from '~/components/forms/styles';
import type { StudyField, StudyFieldReference, StudySelectValue } from './study-form-types';

// ---------------------------------------------------------------------------
// Reference helpers
// ---------------------------------------------------------------------------

function formatReference(reference: string | StudyFieldReference): string {
  if (typeof reference === 'string') return reference;

  const parts: string[] = [];
  if (reference.male) parts.push(`M: ${reference.male}`);
  if (reference.female) parts.push(`F: ${reference.female}`);
  if (reference.child && reference.child !== '–') parts.push(`Niño: ${reference.child}`);
  if (reference.o) parts.push(`Grupo O: ${reference.o}`);
  if (reference.other) parts.push(`Otros: ${reference.other}`);

  return parts.join(' | ');
}

const ReferenceText = styled('span', {
  base: {
    color: 'var(--mantine-color-gray-5)',
    fontSize: 'var(--mantine-font-size-xs)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  },
});

const MethodText = styled('span', {
  base: {
    color: 'var(--mantine-color-gray-5)',
    fontSize: 'var(--mantine-font-size-xs)',
    fontStyle: 'italic',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  },
});

const Separator = styled('div', {
  base: {
    borderBottom: '1px solid var(--mantine-color-gray-3)',
    margin: '0.5rem 0',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StudyFormFieldProps {
  field: StudyField;
  value: string | StudySelectValue;
  onChange: (value: string | StudySelectValue) => void;
  readOnly?: boolean;
  showMethod?: boolean;
}

export function StudyFormField({
  field,
  value,
  onChange,
  readOnly,
  showMethod,
}: StudyFormFieldProps) {
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (val: string) => {
      if (!field.pattern || !val) {
        setError(null);
        return;
      }
      const pattern = new RegExp(field.pattern);
      if (!pattern.test(val)) {
        setError('Formato incorrecto');
      } else {
        setError(null);
      }
    },
    [field.pattern],
  );

  // -- Hide empty fields in read-only mode ----------------------------------
  if (readOnly && field.type !== 'title' && field.type !== 'separator') {
    const isEmpty =
      value === '' ||
      value === null ||
      value === undefined ||
      (typeof value === 'object' && value !== null && !value.value);
    if (isEmpty) return null;
  }

  // -- Title (inline section header within a card) --------------------------
  if (field.type === 'title') {
    return (
      <StyledTitle order={4}>
        <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
      </StyledTitle>
    );
  }

  // -- Separator -------------------------------------------------------------
  if (field.type === 'separator') {
    return <Separator />;
  }

  // Build the reference + method hint line
  const referenceStr = field.reference ? formatReference(field.reference) : null;
  const methodStr = showMethod && field.method ? field.method : null;

  const hint = (referenceStr || methodStr) ? (
    <Group gap="xs" mt={2} wrap="nowrap">
      {referenceStr && <ReferenceText>Ref: {referenceStr}</ReferenceText>}
      {methodStr && <MethodText>({methodStr})</MethodText>}
    </Group>
  ) : null;

  // -- Select ----------------------------------------------------------------
  if (field.type === 'select' && field.options) {
    const selectValue = typeof value === 'object' && value !== null ? value.value : (value as string) ?? '';

    const handleSelectChange = (val: string | null) => {
      if (!val) {
        onChange(null);
        return;
      }
      const option = field.options!.find((o) => o.value === val);
      if (option) {
        onChange({ value: option.value, label: option.label });
      }
    };

    if (readOnly) {
      const displayLabel =
        typeof value === 'object' && value !== null
          ? value.label
          : field.options.find((o) => o.value === value)?.label ?? (value as string) ?? '—';

      return (
        <FieldRow>
          <Label>
            <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
          </Label>
          <Stack gap={0} style={{ flex: 1 }}>
            <Text size="sm">{displayLabel}</Text>
            {hint}
          </Stack>
        </FieldRow>
      );
    }

    return (
      <FieldRow>
        <Label>
          <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
        </Label>
        <Stack gap={0} style={{ flex: 1 }}>
          <StyledSelect
            data={field.options.map((o) => ({ value: o.value, label: o.label }))}
            value={selectValue || null}
            onChange={handleSelectChange}
            placeholder={field.placeholder}
            clearable
          />
          {hint}
        </Stack>
      </FieldRow>
    );
  }

  // -- Textarea --------------------------------------------------------------
  if (field.type === 'textarea') {
    const strValue = (typeof value === 'string' ? value : '') ?? '';

    return (
      <FieldRow>
        <Label>
          <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
        </Label>
        <Stack gap={0} style={{ flex: 1 }}>
          <StyledTextarea
            readOnly={readOnly}
            autosize
            minRows={2}
            placeholder={field.placeholder}
            value={strValue}
            onChange={(e) => onChange(e.currentTarget.value)}
            error={error}
            onBlur={() => validate(strValue)}
          />
          {hint}
        </Stack>
      </FieldRow>
    );
  }

  // -- Input (default) -------------------------------------------------------
  const strValue = (typeof value === 'string' ? value : '') ?? '';

  return (
    <FieldRow>
      <Label>
        <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
      </Label>
      <Stack gap={0} style={{ flex: 1 }}>
        <StyledTextInput
          readOnly={readOnly}
          placeholder={field.placeholder}
          value={strValue}
          onChange={(e) => onChange(e.currentTarget.value)}
          error={error}
          onBlur={() => validate(strValue)}
        />
        {hint}
      </Stack>
    </FieldRow>
  );
}
