import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm } from '@mantine/form';
import { Tabs, Stack, Button, ActionIcon, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Plus, Trash } from 'lucide-react';

import {
  FormContainer,
  FormCard,
  FormHeader,
  StyledTitle,
  ItemHeader,
  IndentedSection,
} from '~/components/forms/styles';
import { EncounterFormField } from './encounter-form-field';
import type {
  EncounterSchema,
  EncounterField,
  EncounterFormValues,
  EncounterFormAdapter,
  FieldCondition,
  EncounterArrayField,
  EncounterTabsField,
  EncounterGroupField,
} from './encounter-form-types';

function evaluateCondition(condition: FieldCondition, values: Record<string, any>, basePath?: string): boolean {
  const fieldPath = basePath ? `${basePath}.${condition.field}` : condition.field;
  const parts = fieldPath.split('.');
  let current: any = values;
  for (const part of parts) {
    if (current == null) return false;
    current = current[part];
  }

  switch (condition.operator) {
    case 'eq':
      return current === condition.value;
    case 'neq':
      if (current === '' || current == null) return false;
      return current !== condition.value;
    case 'truthy':
      return !!current;
    case 'falsy':
      return !current;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(current);
    case 'not_empty':
      return current !== '' && current !== null && current !== undefined;
    default:
      return true;
  }
}

function buildDefaultItem(itemFields: EncounterField[]): Record<string, any> {
  const item: Record<string, any> = {};
  for (const field of itemFields) {
    if (!field.name) continue;
    if (field.type === 'tri-state-checkbox') {
      item[field.name] = 'indeterminate';
    } else if (field.type === 'date') {
      item[field.name] = null;
    } else if (field.type === 'icd10' && field.multi) {
      item[field.name] = [];
    } else {
      item[field.name] = '';
    }
  }
  return item;
}

interface FieldNodeProps {
  field: EncounterField;
  form: ReturnType<typeof useForm<EncounterFormValues>>;
  readOnly?: boolean;
  basePath?: string;
  indented?: boolean;
}

function FieldNode({ field, form, readOnly, basePath, indented }: FieldNodeProps) {
  if (field.condition && !evaluateCondition(field.condition, form.values, basePath)) {
    return null;
  }

  if (field.type === 'tabs') {
    return <TabsNode field={field} form={form} readOnly={readOnly} basePath={basePath} />;
  }

  if (field.type === 'group') {
    return <GroupNode field={field} form={form} readOnly={readOnly} basePath={basePath} />;
  }

  if (field.type === 'array') {
    return <ArrayNode field={field} form={form} readOnly={readOnly} basePath={basePath} />;
  }

  return <EncounterFormField field={field} form={form} readOnly={readOnly} basePath={basePath} indented={indented} />;
}

function TabsNode({
  field,
  form,
  readOnly,
  basePath,
}: {
  field: EncounterTabsField;
  form: ReturnType<typeof useForm<EncounterFormValues>>;
  readOnly?: boolean;
  basePath?: string;
}) {
  const { t } = useTranslation();
  const tl = useCallback((label?: string) => (label ? t(`ef.${label}`, label) : undefined), [t]);
  const defaultTab = field.tabs[0]?.value;

  return (
    <Tabs defaultValue={defaultTab} variant={field.tabStyle ?? 'pills'} color="blue">
      <Tabs.List
        grow={field.grow !== false}
        mb="md"
        bd="1px solid var(--mantine-color-gray-2)"
        style={{ borderRadius: 4 }}
      >
        {field.tabs.map(tab => (
          <Tabs.Tab key={tab.value} value={tab.value}>
            {tl(tab.label)}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {field.tabs.map(tab => (
        <Tabs.Panel key={tab.value} value={tab.value}>
          <FieldList fields={tab.fields} form={form} readOnly={readOnly} basePath={basePath} />
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

function GroupNode({
  field,
  form,
  readOnly,
  basePath,
}: {
  field: EncounterGroupField;
  form: ReturnType<typeof useForm<EncounterFormValues>>;
  readOnly?: boolean;
  basePath?: string;
}) {
  const { t } = useTranslation();
  const tl = useCallback((label?: string) => (label ? t(`ef.${label}`, label) : undefined), [t]);
  const Wrapper = field.indent ? IndentedSection : Stack;
  const wrapperProps = field.indent ? { 'data-indented-section': '' } : { gap: 0 as const };

  return (
    <Wrapper {...wrapperProps}>
      {field.label && (
        <FormHeader>
          <StyledTitle size="h3">{tl(field.label)}</StyledTitle>
        </FormHeader>
      )}
      <FieldList fields={field.fields} form={form} readOnly={readOnly} basePath={basePath} indented={field.indent} />
    </Wrapper>
  );
}

function ArrayNode({
  field,
  form,
  readOnly,
  basePath,
}: {
  field: EncounterArrayField;
  form: ReturnType<typeof useForm<EncounterFormValues>>;
  readOnly?: boolean;
  basePath?: string;
}) {
  const { t } = useTranslation();
  const tl = useCallback((label?: string) => (label ? t(`ef.${label}`, label) : undefined), [t]);
  const arrayPath = basePath ? `${basePath}.${field.name}` : (field.name ?? '');
  const parts = arrayPath.split('.');
  let items: any = form.values;
  for (const part of parts) {
    if (items == null) break;
    items = (items as any)[part];
  }
  if (!Array.isArray(items)) items = [];

  const handleAdd = useCallback(() => {
    const defaultItem = buildDefaultItem(field.itemFields);
    form.insertListItem(arrayPath, defaultItem);
  }, [form, arrayPath, field.itemFields]);

  const handleRemove = useCallback(
    (index: number) => () => {
      form.removeListItem(arrayPath, index);
    },
    [form, arrayPath]
  );

  return (
    <Stack gap="md">
      {items.map((_item: any, index: number) => (
        <div key={index}>
          <ItemHeader>
            <Text size="xl" c="dimmed" fw={500}>
              {field.itemLabel
                ? t(`ef.${field.itemLabel}`, { defaultValue: field.itemLabel, index: index + 1 })
                : `#${index + 1}`}
            </Text>
            {!readOnly && items.length > (field.minItems ?? 0) && (
              <ActionIcon color="red" variant="subtle" onClick={handleRemove(index)}>
                <Trash size={16} />
              </ActionIcon>
            )}
          </ItemHeader>
          <FormCard>
            {field.itemFields.map(itemField => (
              <FieldNode
                key={itemField.name ?? itemField.type}
                field={itemField}
                form={form}
                readOnly={readOnly}
                basePath={`${arrayPath}.${index}`}
              />
            ))}
          </FormCard>
        </div>
      ))}

      {!readOnly && (
        <FormHeader>
          <div />
          <Button
            variant="light"
            leftSection={<Plus size={16} />}
            onClick={handleAdd}
            radius="xl"
            color="gray"
            styles={{
              root: {
                backgroundColor: 'var(--mantine-color-gray-1)',
                color: 'var(--mantine-color-gray-7)',
                border: '1px solid var(--mantine-color-gray-2)',
              },
            }}
          >
            {field.addLabel ? tl(field.addLabel) : 'Agregar'}
          </Button>
        </FormHeader>
      )}
    </Stack>
  );
}

function FieldList({
  fields,
  form,
  readOnly,
  basePath,
  indented,
}: {
  fields: EncounterField[];
  form: ReturnType<typeof useForm<EncounterFormValues>>;
  readOnly?: boolean;
  basePath?: string;
  indented?: boolean;
}) {
  let cardFields: EncounterField[] = [];
  const rendered: React.ReactNode[] = [];

  const flushCard = () => {
    if (cardFields.length > 0) {
      const batch = [...cardFields];
      rendered.push(
        <FormCard key={`card-${rendered.length}`} data-indented-card={indented ? '' : undefined}>
          {batch.map((f, i) => (
            <FieldNode
              key={f.name ?? `${f.type}-${i}`}
              field={f}
              form={form}
              readOnly={readOnly}
              basePath={basePath}
              indented={indented}
            />
          ))}
        </FormCard>
      );
      cardFields = [];
    }
  };

  for (const field of fields) {
    const isCard =
      field.type !== 'title' &&
      field.type !== 'text' &&
      field.type !== 'tabs' &&
      field.type !== 'array' &&
      field.type !== 'group' &&
      field.type !== 'separator';

    if (isCard) {
      cardFields.push(field);
    } else {
      flushCard();
      rendered.push(
        <FieldNode
          key={field.name ?? `${field.type}-${rendered.length}`}
          field={field}
          form={form}
          readOnly={readOnly}
          basePath={basePath}
          indented={indented}
        />
      );
    }
  }
  flushCard();

  return <Stack gap="md">{rendered}</Stack>;
}

export interface EncounterSchemaFormProps {
  schema: EncounterSchema;
  adapter: EncounterFormAdapter;
  initialData?: { type: string; values: Record<string, any> };
  onChange: (data: { type: string; values: Record<string, any> }) => void;
  readOnly?: boolean;
}

export function EncounterSchemaForm({ schema, adapter, initialData, onChange, readOnly }: EncounterSchemaFormProps) {
  const { t } = useTranslation();
  const initialValues = useMemo(
    () => adapter.fromLegacy(initialData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const form = useForm<EncounterFormValues>({ initialValues });
  const prevRef = useRef<string>(JSON.stringify(form.values));

  useEffect(() => {
    if (readOnly) return;

    const serialised = JSON.stringify(form.values);
    if (serialised !== prevRef.current) {
      prevRef.current = serialised;
      const legacy = adapter.toLegacy(form.values);
      onChange(legacy);
    }
  }, [form.values, onChange, readOnly, adapter]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{t(`ef.${schema.label}`, schema.label)}</StyledTitle>
      </FormHeader>
      <FieldList fields={schema.fields} form={form} readOnly={readOnly} />
    </FormContainer>
  );
}
