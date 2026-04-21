import { useCallback } from 'react';
import { Button, Divider, NumberInput, SegmentedControl, Stack, Switch, Text, TextInput } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useBuilder } from '../../builder-context';
import type { BuilderFieldset } from '../../builder-types';
import { SectionTitle } from './styles';
import { TabRow } from './tab-row';

interface Props {
  fieldset: BuilderFieldset;
}

export function FieldsetProperties({ fieldset }: Props) {
  const { dispatch } = useBuilder();
  const { t } = useTranslation();
  const fieldsetId = fieldset._id;

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'UPDATE_FIELDSET', payload: { fieldsetId, title: e.target.value } });
    },
    [dispatch, fieldsetId]
  );

  const handleExtraCostChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'UPDATE_FIELDSET', payload: { fieldsetId, extraCost: e.target.checked } });
    },
    [dispatch, fieldsetId]
  );

  const handleLabelPositionChange = useCallback(
    (value: string) => {
      const labelPosition = value as 'left' | 'top';
      dispatch({
        type: 'UPDATE_FIELDSET',
        payload: {
          fieldsetId,
          labelPosition,
          ...(labelPosition === 'left' ? { columns: 1 } : {}),
        },
      });
    },
    [dispatch, fieldsetId]
  );

  const handleColumnsChange = useCallback(
    (v: number | string) => {
      dispatch({
        type: 'UPDATE_FIELDSET',
        payload: { fieldsetId, columns: typeof v === 'number' ? v : 1 },
      });
    },
    [dispatch, fieldsetId]
  );

  const handleRepeatableChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'UPDATE_FIELDSET', payload: { fieldsetId, repeatable: e.target.checked } });
    },
    [dispatch, fieldsetId]
  );

  const handleAddLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'UPDATE_FIELDSET', payload: { fieldsetId, addLabel: e.target.value } });
    },
    [dispatch, fieldsetId]
  );

  const handleItemLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'UPDATE_FIELDSET', payload: { fieldsetId, itemLabel: e.target.value } });
    },
    [dispatch, fieldsetId]
  );

  const handleMinItemsChange = useCallback(
    (v: number | string) => {
      dispatch({
        type: 'UPDATE_FIELDSET',
        payload: { fieldsetId, minItems: typeof v === 'number' ? v : 1 },
      });
    },
    [dispatch, fieldsetId]
  );

  const handleTabsToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: 'TOGGLE_TABS', payload: { fieldsetId, enabled: e.target.checked } });
    },
    [dispatch, fieldsetId]
  );

  const handleAddTab = useCallback(() => {
    dispatch({ type: 'ADD_TAB', payload: { fieldsetId } });
  }, [dispatch, fieldsetId]);

  const isLeftLabels = (fieldset.labelPosition || 'left') === 'left';

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
        onChange={handleColumnsChange}
      />
      <Divider my="xs" />

      <Switch
        label={t('form_builder.repeatable')}
        description={t('form_builder.repeatable_description')}
        checked={!!fieldset.repeatable}
        onChange={handleRepeatableChange}
      />

      {fieldset.repeatable && (
        <>
          <TextInput
            label={t('form_builder.add_button_label')}
            value={fieldset.addLabel || ''}
            onChange={handleAddLabelChange}
            placeholder={t('form_builder.add_button_placeholder')}
          />
          <TextInput
            label={t('form_builder.item_label_template')}
            description={t('form_builder.item_label_help')}
            value={fieldset.itemLabel || ''}
            onChange={handleItemLabelChange}
          />
          <NumberInput
            label={t('form_builder.min_items')}
            value={fieldset.minItems || 1}
            min={0}
            onChange={handleMinItemsChange}
          />
        </>
      )}

      <Divider my="xs" />

      <Switch
        label={t('form_builder.enable_tabs')}
        description={t('form_builder.enable_tabs_description')}
        checked={!!fieldset.tabs}
        onChange={handleTabsToggle}
      />

      {fieldset.tabs && (
        <>
          <Text size="sm" fw={600}>
            {t('form_builder.tabs_list')}
          </Text>
          {fieldset.tabs.map(tab => (
            <TabRow
              key={tab._id}
              fieldsetId={fieldsetId}
              tabId={tab._id}
              label={tab.label}
              canRemove={fieldset.tabs!.length > 1}
            />
          ))}
          <Button variant="light" size="xs" leftSection={<PlusIcon size={12} />} onClick={handleAddTab}>
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
