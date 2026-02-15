import { useState, useCallback, useMemo } from 'react';
import { Text, Group, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';
import { StyledTextInput, StyledTextarea, StyledSelect, StyledTitle } from '~/components/forms/styles';
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

const FieldRow = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
  },
});

const Label = styled('label', {
  base: {
    color: 'var(--mantine-color-gray-6)',
    fontSize: 'var(--mantine-font-size-sm)',
    transition: 'color 120ms ease',
  },
  variants: {
    focused: {
      true: {
        color: 'var(--mantine-color-blue-6)',
      },
    },
    clickable: {
      true: {
        cursor: 'pointer',
      },
    },
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

export function StudyFormField({ field, value, onChange, readOnly, showMethod }: StudyFormFieldProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const controlId = useMemo(() => {
    const baseName =
      field.name ||
      (field.label ?? '')
        .replace(/<[^>]+>/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return `study-field-${baseName || 'unnamed'}`;
  }, [field.label, field.name]);

  const focusControl = useCallback(() => {
    if (readOnly) return;
    const control = document.getElementById(controlId) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLButtonElement
      | null;
    control?.focus();
  }, [controlId, readOnly]);

  const validate = useCallback(
    (val: string) => {
      if (!field.pattern || !val) {
        setError(null);
        return;
      }
      const pattern = new RegExp(field.pattern);
      if (!pattern.test(val)) {
        setError(t('forms.invalid_format'));
      } else {
        setError(null);
      }
    },
    [field.pattern, t]
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

  const hint =
    referenceStr || methodStr ? (
      <Group
        gap="xs"
        mt={2}
        wrap="nowrap"
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
        onClick={!readOnly ? focusControl : undefined}
      >
        {referenceStr && (
          <ReferenceText>
            {t('forms.reference_prefix')}: {referenceStr}
          </ReferenceText>
        )}
        {methodStr && <MethodText>({methodStr})</MethodText>}
      </Group>
    ) : null;

  // -- Select ----------------------------------------------------------------
  if (field.type === 'select' && field.options) {
    const selectValue = typeof value === 'object' && value !== null ? value.value : ((value as string) ?? '');

    const handleSelectChange = (val: string | null) => {
      if (!val) {
        onChange(null);
        return;
      }
      const option = field.options!.find(o => o.value === val);
      if (option) {
        onChange({ value: option.value, label: option.label });
      }
    };

    if (readOnly) {
      const displayLabel =
        typeof value === 'object' && value !== null
          ? value.label
          : (field.options.find(o => o.value === value)?.label ?? (value as string) ?? '—');

      return (
        <Stack gap={0}>
          <Label>
            <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
          </Label>
          <Stack gap={0} style={{ flex: 1 }}>
            <Text size="sm">{displayLabel}</Text>
            {hint}
          </Stack>
        </Stack>
      );
    }

    return (
      <FieldRow>
        <Label
          focused={isFocused}
          clickable={!readOnly}
          htmlFor={!readOnly ? controlId : undefined}
          onClick={!readOnly ? focusControl : undefined}
        >
          <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
        </Label>
        <Stack gap={0} style={{ flex: 1 }}>
          <StyledSelect
            id={controlId}
            data={field.options.map(o => ({ value: o.value, label: o.label }))}
            value={selectValue || null}
            onChange={handleSelectChange}
            placeholder={field.placeholder}
            clearable
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
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
        <Label
          focused={isFocused}
          clickable={!readOnly}
          htmlFor={!readOnly ? controlId : undefined}
          onClick={!readOnly ? focusControl : undefined}
        >
          <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
        </Label>
        <Stack gap={0} style={{ flex: 1 }}>
          <StyledTextarea
            id={controlId}
            readOnly={readOnly}
            autosize
            minRows={2}
            placeholder={field.placeholder}
            value={strValue}
            onChange={e => onChange(e.currentTarget.value)}
            error={error}
            onBlur={() => validate(strValue)}
            onFocus={!readOnly ? () => setIsFocused(true) : undefined}
            onBlurCapture={!readOnly ? () => setIsFocused(false) : undefined}
          />
          {hint}
        </Stack>
      </FieldRow>
    );
  }

  // -- Input (default) -------------------------------------------------------
  const strValue = (typeof value === 'string' ? value : '') ?? '';

  return (
    <FieldRow gap={0}>
      <Label
        focused={isFocused}
        clickable={!readOnly}
        htmlFor={!readOnly ? controlId : undefined}
        onClick={!readOnly ? focusControl : undefined}
      >
        <span dangerouslySetInnerHTML={{ __html: field.label ?? '' }} />
      </Label>
      <Stack gap={0} style={{ flex: 1 }}>
        <StyledTextInput
          id={controlId}
          readOnly={readOnly}
          placeholder={field.placeholder}
          value={strValue}
          onChange={e => onChange(e.currentTarget.value)}
          error={error}
          onBlur={() => validate(strValue)}
          onFocus={!readOnly ? () => setIsFocused(true) : undefined}
          onBlurCapture={!readOnly ? () => setIsFocused(false) : undefined}
        />
        {hint}
      </Stack>
    </FieldRow>
  );
}
