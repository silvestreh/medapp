import { useCallback, useMemo } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Switch,
  NumberInput,
  Text,
  Divider,
  Textarea,
  ActionIcon,
  Group,
  Button,
  SegmentedControl,
} from '@mantine/core';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';
import { useBuilder } from '../builder-context';
import { findFieldRecursive } from '../builder-reducer';
import type { BuilderField, BuilderFieldset } from '../builder-types';

const PanelContainer = styled('div', {
  base: {
    borderLeft: '1px solid var(--mantine-color-gray-2)',
    backgroundColor: 'white',
    overflowY: 'auto',
    padding: 'var(--mantine-spacing-md)',
    height: '100%',
  },
});

const SectionTitle = styled(Text, {
  base: {
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: 700,
    color: 'var(--mantine-color-gray-5)',
    textTransform: 'uppercase',
    marginBottom: 'var(--mantine-spacing-xs)',
  },
});

export function PropertyEditor() {
  const { state, dispatch } = useBuilder();

  const selectedField = useMemo((): BuilderField | null => {
    if (!state.selectedFieldId) return null;
    for (const fs of state.fieldsets) {
      const found = findFieldRecursive(fs.fields, state.selectedFieldId);
      if (found) return found;
      if (fs.tabs) {
        for (const tab of fs.tabs) {
          const tabFound = findFieldRecursive(tab.fields, state.selectedFieldId);
          if (tabFound) return tabFound;
        }
      }
    }
    return null;
  }, [state.selectedFieldId, state.fieldsets]);

  const selectedFieldset = useMemo((): BuilderFieldset | null => {
    if (!state.selectedFieldsetId) return null;
    return state.fieldsets.find(fs => fs._id === state.selectedFieldsetId) || null;
  }, [state.selectedFieldsetId, state.fieldsets]);

  // Showing field properties
  if (selectedField) {
    return (
      <PanelContainer>
        <FieldProperties field={selectedField} />
      </PanelContainer>
    );
  }

  // Showing fieldset properties
  if (selectedFieldset && !state.selectedFieldId) {
    return (
      <PanelContainer>
        <FieldsetProperties fieldset={selectedFieldset} />
      </PanelContainer>
    );
  }

  // Showing form-level properties
  return (
    <PanelContainer>
      <FormProperties />
    </PanelContainer>
  );
}

function FormProperties() {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_META', payload: { name: e.target.value } });
    },
    [dispatch]
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'SET_META', payload: { label: e.target.value } });
    },
    [dispatch]
  );

  return (
    <Stack gap="sm">
      <SectionTitle>{t('form_builder.form_properties')}</SectionTitle>
      <TextInput
        label={t('form_builder.internal_name')}
        description={t('form_builder.internal_name_description')}
        value={state.name}
        onChange={handleNameChange}
      />
      <TextInput
        label={t('form_builder.display_name')}
        description={t('form_builder.display_name_description')}
        value={state.label}
        onChange={handleLabelChange}
      />
      <Text size="xs" c="dimmed">
        {t('form_builder.field_type')}: {t(`form_builder.type_${state.type}` as any)}
      </Text>
    </Stack>
  );
}

function FieldsetProperties({ fieldset }: { fieldset: BuilderFieldset }) {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'UPDATE_FIELDSET',
        payload: { fieldsetId: fieldset._id, title: e.target.value },
      });
    },
    [dispatch, fieldset._id]
  );

  const handleExtraCostChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'UPDATE_FIELDSET',
        payload: { fieldsetId: fieldset._id, extraCost: e.target.checked },
      });
    },
    [dispatch, fieldset._id]
  );

  const isLeftLabels = (fieldset.labelPosition || 'left') === 'left';

  const handleLabelPositionChange = useCallback(
    (value: string) => {
      const payload: any = { fieldsetId: fieldset._id, labelPosition: value as 'left' | 'top' };
      if (value === 'left') {
        payload.columns = 1;
      }
      dispatch({ type: 'UPDATE_FIELDSET', payload });
    },
    [dispatch, fieldset._id]
  );

  return (
    <Stack gap="sm">
      <SectionTitle>{t('form_builder.fieldset_properties')}</SectionTitle>
      <TextInput
        label={t('form_builder.fieldset_title')}
        value={fieldset.title || ''}
        onChange={handleTitleChange}
        placeholder={t('form_builder.fieldset_title_placeholder')}
      />
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {t('form_builder.fieldset_label_position')}
        </Text>
        <SegmentedControl
          data={[
            { value: 'left', label: t('form_builder.checkbox_label_left') },
            { value: 'top', label: t('form_builder.label_top') },
          ]}
          value={fieldset.labelPosition || 'left'}
          onChange={handleLabelPositionChange}
          fullWidth
          size="xs"
        />
      </Stack>
      <NumberInput
        label={t('form_builder.columns')}
        description={
          isLeftLabels ? t('form_builder.columns_disabled_left_labels') : t('form_builder.columns_description')
        }
        value={isLeftLabels ? 1 : fieldset.columns || 1}
        min={1}
        max={4}
        disabled={isLeftLabels}
        onChange={v =>
          dispatch({
            type: 'UPDATE_FIELDSET',
            payload: { fieldsetId: fieldset._id, columns: typeof v === 'number' ? v : 1 },
          })
        }
      />
      <Divider my="xs" />

      <Switch
        label={t('form_builder.repeatable')}
        description={t('form_builder.repeatable_description')}
        checked={!!fieldset.repeatable}
        onChange={e =>
          dispatch({
            type: 'UPDATE_FIELDSET',
            payload: { fieldsetId: fieldset._id, repeatable: e.target.checked },
          })
        }
      />

      {fieldset.repeatable && (
        <>
          <TextInput
            label={t('form_builder.add_button_label')}
            value={fieldset.addLabel || ''}
            onChange={e =>
              dispatch({
                type: 'UPDATE_FIELDSET',
                payload: { fieldsetId: fieldset._id, addLabel: e.target.value },
              })
            }
            placeholder={t('form_builder.add_button_placeholder')}
          />
          <TextInput
            label={t('form_builder.item_label_template')}
            description={t('form_builder.item_label_help')}
            value={fieldset.itemLabel || ''}
            onChange={e =>
              dispatch({
                type: 'UPDATE_FIELDSET',
                payload: { fieldsetId: fieldset._id, itemLabel: e.target.value },
              })
            }
          />
          <NumberInput
            label={t('form_builder.min_items')}
            value={fieldset.minItems || 1}
            min={0}
            onChange={v =>
              dispatch({
                type: 'UPDATE_FIELDSET',
                payload: { fieldsetId: fieldset._id, minItems: typeof v === 'number' ? v : 1 },
              })
            }
          />
        </>
      )}

      <Divider my="xs" />

      <Switch
        label={t('form_builder.enable_tabs')}
        description={t('form_builder.enable_tabs_description')}
        checked={!!fieldset.tabs}
        onChange={e =>
          dispatch({
            type: 'TOGGLE_TABS',
            payload: { fieldsetId: fieldset._id, enabled: e.target.checked },
          })
        }
      />

      {fieldset.tabs && (
        <>
          <Text size="sm" fw={600}>
            {t('form_builder.tabs_list')}
          </Text>
          {fieldset.tabs.map(tab => (
            <Group key={tab._id} gap="xs" wrap="nowrap">
              <TextInput
                value={tab.label}
                onChange={e =>
                  dispatch({
                    type: 'UPDATE_TAB',
                    payload: { fieldsetId: fieldset._id, tabId: tab._id, label: e.target.value },
                  })
                }
                size="xs"
                style={{ flex: 1 }}
              />
              {fieldset.tabs!.length > 1 && (
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() =>
                    dispatch({
                      type: 'REMOVE_TAB',
                      payload: { fieldsetId: fieldset._id, tabId: tab._id },
                    })
                  }
                >
                  <TrashIcon size={12} />
                </ActionIcon>
              )}
            </Group>
          ))}
          <Button
            variant="light"
            size="xs"
            leftSection={<PlusIcon size={12} />}
            onClick={() =>
              dispatch({
                type: 'ADD_TAB',
                payload: { fieldsetId: fieldset._id },
              })
            }
          >
            {t('form_builder.add_tab')}
          </Button>
        </>
      )}

      <Divider my="xs" />

      <Switch
        label={t('form_builder.extra_cost_section')}
        checked={!!fieldset.extraCost}
        onChange={handleExtraCostChange}
      />
    </Stack>
  );
}

function FieldProperties({ field: bf }: { field: BuilderField }) {
  const { state, dispatch } = useBuilder();
  const { t } = useTranslation();
  const field = bf.field;

  const parentFieldset = useMemo(
    () =>
      state.fieldsets.find(fs => {
        if (findFieldRecursive(fs.fields, bf._id)) return true;
        if (fs.tabs) {
          return fs.tabs.some(tab => findFieldRecursive(tab.fields, bf._id));
        }
        return false;
      }),
    [state.fieldsets, bf._id]
  );
  const parentColumns = parentFieldset?.columns || 1;

  const updateField = useCallback(
    (changes: Record<string, any>) => {
      dispatch({
        type: 'UPDATE_FIELD',
        payload: { fieldId: bf._id, changes },
      });
    },
    [dispatch, bf._id]
  );

  return (
    <Stack gap="sm">
      <SectionTitle>{t('form_builder.field_properties')}</SectionTitle>
      <Text size="xs" c="dimmed" fw={600}>
        {t('form_builder.field_type')}: {field.type}
      </Text>

      {'name' in field && (
        <TextInput
          label={t('form_builder.field_name')}
          description={t('form_builder.field_name_description')}
          value={(field as any).name || ''}
          onChange={e => updateField({ name: e.target.value })}
        />
      )}

      {'label' in field && (
        <TextInput
          label={t('form_builder.field_label')}
          value={(field as any).label || ''}
          onChange={e => updateField({ label: e.target.value })}
        />
      )}

      {'placeholder' in field && (
        <TextInput
          label={t('form_builder.field_placeholder')}
          value={(field as any).placeholder || ''}
          onChange={e => updateField({ placeholder: e.target.value })}
        />
      )}

      {parentColumns > 1 && (
        <NumberInput
          label={t('form_builder.col_span')}
          description={t('form_builder.col_span_description', { columns: parentColumns })}
          value={(field as any).colSpan || 1}
          min={1}
          max={parentColumns}
          onChange={v => updateField({ colSpan: typeof v === 'number' ? v : 1 })}
        />
      )}

      <Divider my="xs" />

      {/* Type-specific properties */}
      {field.type === 'input' && <InputProperties field={field} onUpdate={updateField} />}
      {field.type === 'textarea' && <TextareaProperties field={field} onUpdate={updateField} />}
      {field.type === 'select' && <SelectProperties field={field} onUpdate={updateField} />}
      {field.type === 'date' && <DateProperties field={field} onUpdate={updateField} />}
      {field.type === 'tri-state-checkbox' && <CheckboxProperties field={field} onUpdate={updateField} />}
      {field.type === 'icd10' && <Icd10Properties field={field} onUpdate={updateField} />}
      {field.type === 'group' && <GroupProperties field={field} onUpdate={updateField} />}
    </Stack>
  );
}

function InputProperties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Select
        label={t('form_builder.input_type')}
        data={[
          { value: 'text', label: t('form_builder.input_type_text') },
          { value: 'number', label: t('form_builder.input_type_number') },
        ]}
        value={field.inputType || 'text'}
        onChange={v => onUpdate({ inputType: v })}
      />
      <TextInput
        label={t('form_builder.pattern')}
        value={field.pattern || ''}
        onChange={e => onUpdate({ pattern: e.target.value })}
        placeholder="e.g. ^[0-9]+$"
      />
      <TextInput
        label={t('form_builder.reference')}
        value={typeof field.reference === 'string' ? field.reference : ''}
        onChange={e => onUpdate({ reference: e.target.value })}
        placeholder="e.g. 10 – 15"
      />
      <TextInput
        label={t('form_builder.unit')}
        value={field.unit || ''}
        onChange={e => onUpdate({ unit: e.target.value })}
      />
      <TextInput
        label={t('form_builder.method')}
        value={field.method || ''}
        onChange={e => onUpdate({ method: e.target.value })}
      />
    </Stack>
  );
}

function TextareaProperties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  return (
    <NumberInput
      label={t('form_builder.min_rows')}
      value={field.minRows || 2}
      min={1}
      max={20}
      onChange={v => onUpdate({ minRows: v })}
    />
  );
}

function CheckboxProperties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {t('form_builder.checkbox_label_position')}
        </Text>
        <SegmentedControl
          data={[
            { value: 'default', label: t('form_builder.checkbox_label_left') },
            { value: 'checkbox', label: t('form_builder.checkbox_label_right') },
          ]}
          value={field.variant === 'checkbox' ? 'checkbox' : 'default'}
          onChange={v => onUpdate({ variant: v === 'checkbox' ? 'checkbox' : undefined })}
          fullWidth
          size="xs"
        />
      </Stack>
      {field.variant === 'checkbox' && (
        <Switch
          label={t('form_builder.checkbox_spacer')}
          description={t('form_builder.checkbox_spacer_description')}
          checked={!!field.indent}
          onChange={e => onUpdate({ indent: e.target.checked })}
        />
      )}
    </Stack>
  );
}

function SelectProperties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  const options = field.options || [];

  const handleAddOption = useCallback(() => {
    onUpdate({
      options: [...options, { value: `option${options.length + 1}`, label: `Option ${options.length + 1}` }],
    });
  }, [options, onUpdate]);

  const handleRemoveOption = useCallback(
    (index: number) => {
      const next = options.filter((_: any, i: number) => i !== index);
      onUpdate({ options: next });
    },
    [options, onUpdate]
  );

  const handleOptionChange = useCallback(
    (index: number, key: 'value' | 'label', val: string) => {
      const next = options.map((o: any, i: number) => (i === index ? { ...o, [key]: val } : o));
      onUpdate({ options: next });
    },
    [options, onUpdate]
  );

  return (
    <Stack gap="xs">
      <Switch
        label={t('form_builder.clearable')}
        checked={!!field.clearable}
        onChange={e => onUpdate({ clearable: e.target.checked })}
      />
      <Text size="sm" fw={600}>
        {t('form_builder.options')}
      </Text>
      {options.map((opt: any, index: number) => (
        <Group key={index} gap="xs" wrap="nowrap">
          <TextInput
            placeholder="Value"
            value={opt.value}
            onChange={e => handleOptionChange(index, 'value', e.target.value)}
            size="xs"
            style={{ flex: 1 }}
          />
          <TextInput
            placeholder={t('form_builder.field_label')}
            value={opt.label}
            onChange={e => handleOptionChange(index, 'label', e.target.value)}
            size="xs"
            style={{ flex: 1 }}
          />
          <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleRemoveOption(index)}>
            <TrashIcon size={12} />
          </ActionIcon>
        </Group>
      ))}
      <Button variant="light" size="xs" leftSection={<PlusIcon size={12} />} onClick={handleAddOption}>
        {t('form_builder.add_option')}
      </Button>
    </Stack>
  );
}

function DateProperties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  return (
    <TextInput
      label={t('form_builder.value_format')}
      value={field.valueFormat || 'DD/MM/YYYY'}
      onChange={e => onUpdate({ valueFormat: e.target.value })}
    />
  );
}

function Icd10Properties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  return (
    <Switch
      label={t('form_builder.multi_selection')}
      checked={!!field.multi}
      onChange={e => onUpdate({ multi: e.target.checked })}
    />
  );
}

function GroupProperties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  return (
    <TextInput
      label={t('form_builder.toggle_label')}
      description={t('form_builder.toggle_label_description')}
      value={field.toggleLabel || ''}
      onChange={e => onUpdate({ toggleLabel: e.target.value })}
    />
  );
}

function ArrayProperties({ field, onUpdate }: { field: any; onUpdate: (c: any) => void }) {
  const { t } = useTranslation();
  return (
    <Stack gap="xs">
      <NumberInput
        label={t('form_builder.min_items')}
        value={field.minItems || 1}
        min={0}
        onChange={v => onUpdate({ minItems: v })}
      />
      <TextInput
        label={t('form_builder.add_button_label')}
        value={field.addLabel || ''}
        onChange={e => onUpdate({ addLabel: e.target.value })}
      />
      <TextInput
        label={t('form_builder.item_label_template')}
        description={t('form_builder.item_label_help')}
        value={field.itemLabel || ''}
        onChange={e => onUpdate({ itemLabel: e.target.value })}
      />
    </Stack>
  );
}
