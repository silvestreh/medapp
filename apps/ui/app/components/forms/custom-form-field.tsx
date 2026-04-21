import { useCallback } from 'react';
import { Text } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { styled } from '~/styled-system/jsx';

import { FieldRow, StyledTextarea, StyledSelect, StyledDateInput, TriStateCheckbox } from '~/components/forms/styles';
import { Icd10Selector } from '~/components/icd10-selector';
import { MedicationSelector } from '~/components/medication-selector';
import { formatReference, type FieldReference } from './format-reference';
import { InlineUnitInput } from './inline-unit-input';
import type { CustomFormField, CustomFormValues } from '@athelas/encounter-schemas';

const Separator = styled('div', {
  base: {
    borderBottom: '1px solid var(--mantine-color-gray-3)',
    margin: '0.5rem 0',
  },
});

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

interface CustomFormFieldProps {
  field: CustomFormField;
  form: UseFormReturnType<CustomFormValues>;
  readOnly?: boolean;
  basePath?: string;
  labelPosition?: 'left' | 'top';
}

function getFieldPath(basePath: string | undefined, name: string | undefined): string {
  if (!name) return '';
  return basePath ? `${basePath}.${name}` : name;
}

function getFieldValue(form: UseFormReturnType<CustomFormValues>, path: string): any {
  if (!path) return '';
  const parts = path.split('.');
  let current: any = form.values;
  for (const part of parts) {
    if (current == null) return '';
    current = current[part];
  }
  return current;
}

export function CustomFormFieldRenderer({
  field,
  form,
  readOnly,
  basePath,
  labelPosition = 'left',
}: CustomFormFieldProps) {
  const path = getFieldPath(basePath, field.name);
  const value = path ? getFieldValue(form, path) : '';
  const isTopLabel = labelPosition === 'top';

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (path) form.setFieldValue(path, e.currentTarget.value);
    },
    [form, path]
  );

  const handleSelectChange = useCallback(
    (val: string | null) => {
      if (path) form.setFieldValue(path, val ?? '');
    },
    [form, path]
  );

  const handleIcd10Change = useCallback(
    (val: string | string[]) => {
      if (path) form.setFieldValue(path, val);
    },
    [form, path]
  );

  const handleMedicationChange = useCallback(
    (val: string) => {
      if (path) form.setFieldValue(path, val);
    },
    [form, path]
  );

  // Determine variant for non-checkbox fields
  const stacked = isTopLabel || field.variant === 'stacked' ? ('stacked' as const) : undefined;

  if (field.type === 'separator') {
    return <Separator />;
  }

  if (field.type === 'input') {
    const hint = renderReferenceHint(field.reference);
    if (readOnly) {
      return (
        <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked} hint={hint}>
          <Text size="sm" style={{ lineHeight: 1.75, minHeight: '1.75rem' }}>
            {value || ''}
            {field.unit && value ? ` ${field.unit}` : ''}
          </Text>
        </FieldRow>
      );
    }
    return (
      <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked} hint={hint}>
        <InlineUnitInput
          type={field.inputType || 'text'}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={handleTextChange}
          unit={field.unit}
        />
      </FieldRow>
    );
  }

  if (field.type === 'textarea') {
    const hint = renderReferenceHint(field.reference);
    if (readOnly) {
      return (
        <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked} hint={hint}>
          <Text size="sm" style={{ lineHeight: 1.75, minHeight: '1.75rem', whiteSpace: 'pre-wrap' }}>
            {value || ''}
          </Text>
        </FieldRow>
      );
    }
    return (
      <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked} hint={hint}>
        <StyledTextarea
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={handleTextChange}
          readOnly={readOnly}
          autosize
          minRows={field.minRows ?? 1}
          rightSection={renderUnitSection(field.unit)}
        />
      </FieldRow>
    );
  }

  if (field.type === 'select') {
    if (readOnly) {
      let displayValue = value || '';
      const flatOptions = Array.isArray(field.options)
        ? 'items' in (field.options[0] || {})
          ? (field.options as any[]).flatMap((g: any) => g.items)
          : field.options
        : [];
      const found = flatOptions.find((o: any) => o.value === value);
      if (found) displayValue = found.label;

      return (
        <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked}>
          <Text size="sm" style={{ lineHeight: 1.75, minHeight: '1.75rem' }}>
            {displayValue}
          </Text>
        </FieldRow>
      );
    }
    return (
      <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked}>
        <StyledSelect
          data={field.options as any}
          placeholder={field.placeholder ?? 'Seleccione...'}
          value={value || null}
          onChange={handleSelectChange}
          readOnly={readOnly}
          clearable={field.clearable}
          variant="unstyled"
          flex={1}
        />
      </FieldRow>
    );
  }

  if (field.type === 'date') {
    return (
      <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked}>
        <StyledDateInput
          placeholder={field.placeholder ?? 'DD/MM/YYYY'}
          {...form.getInputProps(path)}
          readOnly={readOnly}
          valueFormat={field.valueFormat ?? 'DD/MM/YYYY'}
          clearable={!readOnly}
        />
      </FieldRow>
    );
  }

  if (field.type === 'tri-state-checkbox') {
    // When section labels are on top, or variant is 'checkbox': label goes right of checkbox
    const labelOnRight = isTopLabel || field.variant === 'checkbox';
    const withSpacer = !isTopLabel && field.variant === 'checkbox' && field.indent;

    if (labelOnRight) {
      return (
        <FieldRow checkbox={withSpacer || undefined}>
          <TriStateCheckbox label={field.label} {...form.getInputProps(path)} readOnly={readOnly} />
        </FieldRow>
      );
    }

    // Label on the left: "Label: [ ]"
    return (
      <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked}>
        <TriStateCheckbox {...form.getInputProps(path)} readOnly={readOnly} />
      </FieldRow>
    );
  }

  if (field.type === 'icd10') {
    return (
      <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked}>
        <Icd10Selector
          value={value}
          onChange={handleIcd10Change}
          multiSelect={!!field.multi}
          readOnly={readOnly}
          variant="unstyled"
        />
      </FieldRow>
    );
  }

  if (field.type === 'medication') {
    return (
      <FieldRow label={field.label ? `${field.label}:` : undefined} variant={stacked}>
        <MedicationSelector value={value} onChange={handleMedicationChange} readOnly={readOnly} />
      </FieldRow>
    );
  }

  return null;
}
