import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm, type UseFormReturnType } from '@mantine/form';
import { Stack, Button, ActionIcon, Text, Tabs } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';

import { FormContainer, FormCard, FormHeader, StyledTitle, ItemHeader } from '~/components/forms/styles';
import { CustomFormFieldRenderer } from './custom-form-field';
import type { FormTemplateSchema, Fieldset, CustomFormField, CustomFormValues } from '@athelas/encounter-schemas';

function buildDefaultItem(fields: CustomFormField[]): Record<string, any> {
  const item: Record<string, any> = {};
  for (const field of fields) {
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

function buildInitialValues(schema: FormTemplateSchema): Record<string, any> {
  const values: Record<string, any> = {};
  for (const fs of schema.fieldsets) {
    if (fs.repeatable) {
      const name = `repeater_${fs.id}`;
      const minItems = fs.minItems ?? 1;
      values[name] = Array.from({ length: Math.max(minItems, 1) }, () =>
        buildDefaultItem(fs.fields as CustomFormField[])
      );
    }
  }
  return values;
}

function isFieldEmpty(value: any): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (value === 'indeterminate') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
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

// ---------------------------------------------------------------------------
// Fieldset renderers
// ---------------------------------------------------------------------------

interface FieldsetRendererProps {
  fieldset: Fieldset<CustomFormField>;
  index: number;
  form: UseFormReturnType<CustomFormValues>;
  readOnly?: boolean;
}

function StaticFieldset({ fieldset, form, readOnly }: FieldsetRendererProps) {
  const fields = fieldset.fields;
  const isTopLabel = fieldset.labelPosition === 'top';
  const columns = isTopLabel ? fieldset.columns || 1 : 1;

  const visibleFields = useMemo(() => {
    if (!readOnly) return fields;
    return fields.filter(f => {
      if (!f.name) return true;
      const val = getFieldValue(form, f.name);
      return !isFieldEmpty(val);
    });
  }, [fields, readOnly, form]);

  const renderFields = useCallback(
    (fieldsToRender: CustomFormField[]) => {
      const filtered = readOnly
        ? fieldsToRender.filter(f => {
            if (!f.name) return true;
            const val = getFieldValue(form, f.name);
            return !isFieldEmpty(val);
          })
        : fieldsToRender;

      if (columns > 1) {
        // Build rows to insert full-width separators between them
        const rows: CustomFormField[][] = [];
        let currentRow: CustomFormField[] = [];
        let colsUsed = 0;

        for (const field of filtered) {
          const span = Math.min((field as any).colSpan || 1, columns);
          if (colsUsed + span > columns && currentRow.length > 0) {
            rows.push(currentRow);
            currentRow = [];
            colsUsed = 0;
          }
          currentRow.push(field);
          colsUsed += span;
        }
        if (currentRow.length > 0) rows.push(currentRow);

        return (
          <div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex}>
                {rowIndex > 0 && <div style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }} />}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                  {row.map((field, i) => {
                    const colSpan = Math.min((field as any).colSpan || 1, columns);
                    return (
                      <div key={field.name ?? `${field.type}-${i}`} style={{ gridColumn: `span ${colSpan}` }}>
                        <CustomFormFieldRenderer
                          field={field}
                          form={form}
                          readOnly={readOnly}
                          labelPosition={fieldset.labelPosition}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      }

      return (
        <>
          {filtered.map((field, i) => (
            <CustomFormFieldRenderer
              key={field.name ?? `${field.type}-${i}`}
              field={field}
              form={form}
              readOnly={readOnly}
              labelPosition={fieldset.labelPosition}
            />
          ))}
        </>
      );
    },
    [columns, fieldset.labelPosition, form, readOnly]
  );

  return (
    <Stack gap="sm">
      {fieldset.title && (
        <Text size="lg" fw={600} c="gray.8">
          {fieldset.title}
        </Text>
      )}
      {fieldset.tabs ? (
        <Tabs defaultValue={fieldset.tabs[0]?.value} variant={fieldset.tabStyle ?? 'pills'}>
          <Tabs.List grow mb="md">
            {fieldset.tabs.map(tab => (
              <Tabs.Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {fieldset.tabs.map(tab => (
            <Tabs.Panel key={tab.value} value={tab.value}>
              <FormCard>{renderFields(tab.fields as CustomFormField[])}</FormCard>
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        <FormCard>{renderFields(visibleFields)}</FormCard>
      )}
    </Stack>
  );
}

function renderItemFields(
  fields: CustomFormField[],
  basePath: string,
  columns: number,
  labelPosition: 'left' | 'top' | undefined,
  form: UseFormReturnType<CustomFormValues>,
  readOnly?: boolean
) {
  const rendered = fields.map((field, fi) => {
    if (readOnly && field.name) {
      const val = getFieldValue(form, `${basePath}.${field.name}`);
      if (isFieldEmpty(val)) return null;
    }

    if (columns > 1) {
      const colSpan = (field as any).colSpan || 1;
      return (
        <div key={field.name ?? `${field.type}-${fi}`} style={{ gridColumn: `span ${Math.min(colSpan, columns)}` }}>
          <CustomFormFieldRenderer
            field={field}
            form={form}
            readOnly={readOnly}
            basePath={basePath}
            labelPosition={labelPosition}
          />
        </div>
      );
    }

    return (
      <CustomFormFieldRenderer
        key={field.name ?? `${field.type}-${fi}`}
        field={field}
        form={form}
        readOnly={readOnly}
        basePath={basePath}
        labelPosition={labelPosition}
      />
    );
  });

  if (columns > 1) {
    return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}>{rendered}</div>;
  }

  return <>{rendered}</>;
}

function RepeatableFieldset({ fieldset, form, readOnly }: FieldsetRendererProps) {
  const { t } = useTranslation();
  const allFields = fieldset.tabs
    ? fieldset.tabs.flatMap(tab => tab.fields as CustomFormField[])
    : (fieldset.fields as CustomFormField[]);
  const arrayPath = `repeater_${fieldset.id}`;
  const isTopLabel = fieldset.labelPosition === 'top';
  const columns = isTopLabel ? fieldset.columns || 1 : 1;

  let items: any = form.values[arrayPath];
  if (!Array.isArray(items)) items = [];

  const handleAdd = useCallback(() => {
    const defaultItem = buildDefaultItem(allFields);
    form.insertListItem(arrayPath, defaultItem);
  }, [form, arrayPath, allFields]);

  const handleRemove = useCallback(
    (index: number) => () => {
      form.removeListItem(arrayPath, index);
    },
    [form, arrayPath]
  );

  return (
    <Stack gap="md">
      {fieldset.title && (
        <Text size="xl" fw={600} c="gray.8">
          {fieldset.title}
        </Text>
      )}

      {items.map((_item: any, index: number) => (
        <div key={index}>
          <ItemHeader>
            <Text size="md" c="dimmed" fw={500}>
              {fieldset.itemLabel ? fieldset.itemLabel.replace('{{index}}', String(index + 1)) : `#${index + 1}`}
            </Text>
            {!readOnly && items.length > (fieldset.minItems ?? 0) && (
              <ActionIcon color="red" variant="subtle" onClick={handleRemove(index)}>
                <TrashIcon size={16} />
              </ActionIcon>
            )}
          </ItemHeader>
          {fieldset.tabs ? (
            <Tabs defaultValue={fieldset.tabs[0]?.value} variant={fieldset.tabStyle ?? 'pills'}>
              <Tabs.List grow mb="md">
                {fieldset.tabs.map(tab => (
                  <Tabs.Tab key={tab.value} value={tab.value}>
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
              {fieldset.tabs.map(tab => (
                <Tabs.Panel key={tab.value} value={tab.value}>
                  <FormCard>
                    {renderItemFields(
                      tab.fields as CustomFormField[],
                      `${arrayPath}.${index}`,
                      columns,
                      fieldset.labelPosition,
                      form,
                      readOnly
                    )}
                  </FormCard>
                </Tabs.Panel>
              ))}
            </Tabs>
          ) : (
            <FormCard>
              {renderItemFields(allFields, `${arrayPath}.${index}`, columns, fieldset.labelPosition, form, readOnly)}
            </FormCard>
          )}
        </div>
      ))}

      {!readOnly && (
        <FormHeader>
          <div />
          <Button
            variant="light"
            leftSection={<PlusIcon size={16} />}
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
            {fieldset.addLabel || t('form_builder.add_item_default')}
          </Button>
        </FormHeader>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CustomFormRendererProps {
  schema: FormTemplateSchema;
  initialData?: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  readOnly?: boolean;
}

export function CustomFormRenderer({ schema, initialData, onChange, readOnly }: CustomFormRendererProps) {
  const initialValues = useMemo(() => {
    const defaults = buildInitialValues(schema);
    return { ...defaults, ...(initialData || {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<CustomFormValues>({ initialValues });
  const prevRef = useRef<string>(JSON.stringify(form.values));

  useEffect(() => {
    if (readOnly) return;

    const serialised = JSON.stringify(form.values);
    if (serialised !== prevRef.current) {
      prevRef.current = serialised;
      onChange(form.values);
    }
  }, [form.values, onChange, readOnly]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle>{schema.label}</StyledTitle>
      </FormHeader>
      <Stack gap="xl">
        {schema.fieldsets.map((fs, index) => {
          if (fs.repeatable) {
            return <RepeatableFieldset key={fs.id} fieldset={fs} index={index} form={form} readOnly={readOnly} />;
          }
          return <StaticFieldset key={fs.id} fieldset={fs} index={index} form={form} readOnly={readOnly} />;
        })}
      </Stack>
    </FormContainer>
  );
}
