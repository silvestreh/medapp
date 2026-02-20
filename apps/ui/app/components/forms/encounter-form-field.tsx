import { useCallback } from 'react';
import { Text } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';

import {
  FieldRow,
  StyledTextInput,
  StyledTextarea,
  StyledSelect,
  StyledDateInput,
  StyledTitle,
  TriStateCheckbox,
  IndentedSection,
} from '~/components/forms/styles';
import { Icd10Selector } from '~/components/icd10-selector';
import { MedicationSelector } from '~/components/medication-selector';
import type { EncounterField, EncounterFormValues } from './encounter-form-types';

const Separator = styled('div', {
  base: {
    borderBottom: '1px solid var(--mantine-color-gray-3)',
    margin: '0.5rem 0',
  },
});

interface EncounterFormFieldProps {
  field: EncounterField;
  form: UseFormReturnType<EncounterFormValues>;
  readOnly?: boolean;
  basePath?: string;
  indented?: boolean;
}

function getFieldPath(basePath: string | undefined, name: string | undefined): string {
  if (!name) return '';
  return basePath ? `${basePath}.${name}` : name;
}

function getFieldValue(form: UseFormReturnType<EncounterFormValues>, path: string): any {
  if (!path) return '';
  const parts = path.split('.');
  let current: any = form.values;
  for (const part of parts) {
    if (current == null) return '';
    current = current[part];
  }
  return current;
}

export function EncounterFormField({ field, form, readOnly, basePath, indented }: EncounterFormFieldProps) {
  const { t } = useTranslation();
  const tl = useCallback((label?: string) => (label ? t(`ef.${label}`, label) : undefined), [t]);
  const path = getFieldPath(basePath, field.name);
  const value = path ? getFieldValue(form, path) : '';

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

  if (field.type === 'title') {
    return <StyledTitle size="h3">{tl(field.label)}</StyledTitle>;
  }

  if (field.type === 'text') {
    return (
      <Text fw={500} size="sm" c="gray.7" px="md">
        {tl(field.label)}
      </Text>
    );
  }

  if (field.type === 'separator') {
    return <Separator />;
  }

  if (field.type === 'input') {
    const stackedVariant = indented || field.variant === 'stacked' ? ('stacked' as const) : undefined;
    if (readOnly) {
      return (
        <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
          <Text size="sm" style={{ lineHeight: 1.75, minHeight: '1.75rem' }}>
            {value || ''}
          </Text>
        </FieldRow>
      );
    }
    return (
      <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
        <StyledTextInput
          type={field.inputType || 'text'}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={handleTextChange}
          readOnly={readOnly}
        />
      </FieldRow>
    );
  }

  if (field.type === 'textarea') {
    const stackedVariant = indented || field.variant === 'stacked' ? ('stacked' as const) : undefined;
    if (readOnly) {
      return (
        <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
          <Text size="sm" style={{ lineHeight: 1.75, minHeight: '1.75rem', whiteSpace: 'pre-wrap' }}>
            {value || ''}
          </Text>
        </FieldRow>
      );
    }
    return (
      <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
        <StyledTextarea
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={handleTextChange}
          readOnly={readOnly}
          autosize
          minRows={field.minRows ?? 1}
        />
      </FieldRow>
    );
  }

  if (field.type === 'select') {
    const stackedVariant = indented || field.variant === 'stacked' ? ('stacked' as const) : undefined;
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
        <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
          <Text size="sm" style={{ lineHeight: 1.75, minHeight: '1.75rem' }}>
            {displayValue}
          </Text>
        </FieldRow>
      );
    }
    return (
      <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
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
    const stackedVariant = indented || field.variant === 'stacked' ? ('stacked' as const) : undefined;
    return (
      <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
        <StyledDateInput
          placeholder={field.placeholder ?? 'Haga clic para seleccionar una fecha'}
          {...form.getInputProps(path)}
          readOnly={readOnly}
          valueFormat={field.valueFormat ?? 'DD/MM/YYYY'}
          clearable={!readOnly}
        />
      </FieldRow>
    );
  }

  if (field.type === 'tri-state-checkbox') {
    if (field.indent) {
      return (
        <IndentedSection>
          <FieldRow label="" variant="stacked">
            <TriStateCheckbox label={tl(field.label)} {...form.getInputProps(path)} readOnly={readOnly} />
          </FieldRow>
        </IndentedSection>
      );
    }
    if (indented) {
      return (
        <FieldRow>
          <TriStateCheckbox label={field.label} {...form.getInputProps(path)} readOnly={readOnly} />
        </FieldRow>
      );
    }
    return (
      <FieldRow
        checkbox
        noOffset={field.variant === 'noOffset' || undefined}
        nested={field.variant === 'nested' || undefined}
      >
        <TriStateCheckbox label={field.label} {...form.getInputProps(path)} readOnly={readOnly} />
      </FieldRow>
    );
  }

  if (field.type === 'icd10') {
    const stackedVariant = indented || field.variant === 'stacked' ? ('stacked' as const) : undefined;
    return (
      <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
        <Icd10Selector
          value={field.multi ? (Array.isArray(value) ? value : []) : value || ''}
          onChange={handleIcd10Change}
          placeholder={field.placeholder}
          readOnly={readOnly}
          multiSelect={field.multi}
        />
      </FieldRow>
    );
  }

  if (field.type === 'medication') {
    const stackedVariant = indented || field.variant === 'stacked' ? ('stacked' as const) : undefined;
    return (
      <FieldRow label={field.label ? `${tl(field.label)}:` : undefined} variant={stackedVariant}>
        <MedicationSelector
          value={value || ''}
          onChange={handleMedicationChange}
          placeholder={field.placeholder}
          readOnly={readOnly}
        />
      </FieldRow>
    );
  }

  return null;
}
