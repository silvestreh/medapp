import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import { ActionIcon, Button, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { authenticatedLoader, getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { ToolbarTitle } from '~/components/toolbar-title';
import { PrepagaSelector } from '~/components/prepaga-selector';
import {
  ACCOUNTING_PRACTICE_KEYS,
  toPricingConfig,
  normalizeInsurerPrices,
  toNumericPrice,
  type PricingConfig,
  type InsurerPrices,
} from '~/utils/accounting';
import { parseFormJson } from '~/utils/parse-form-json';
import { styled } from '~/styled-system/jsx';

type Prepaga = {
  id: string;
  shortName: string;
  denomination: string;
};

const Layout = styled('div', {
  base: {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: '1fr',
    padding: '1rem',
    md: {
      gridTemplateColumns: '320px 1fr',
      padding: '2rem',
    },
  },
});

const Sidebar = styled('div', {
  base: {
    backgroundColor: 'white',
    border: '1px solid var(--mantine-color-gray-3)',
    borderRadius: 'var(--mantine-radius-sm)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxHeight: 'calc(100vh - 10rem)',
  },
});

const SidebarList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflowY: 'auto',
  },
});

const practiceLabelByKey: Record<string, string> = {
  encounter: 'Encounter',
  anemia: 'Anemia',
  anticoagulation: 'Anticoagulation',
  compatibility: 'Compatibility',
  hemostasis: 'Hemostasis',
  myelogram: 'Myelogram',
  thrombophilia: 'Thrombophilia',
};

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);

  const settingsResponse = await client.service('md-settings').find({
    query: { userId: user.id, $limit: 1 },
    paginate: false,
  });

  const settingsList = Array.isArray(settingsResponse)
    ? settingsResponse
    : ((settingsResponse as { data?: unknown[] }).data ?? []);
  const mdSettings = settingsList[0] as { id: string; insurerPrices?: unknown } | undefined;
  const insurerPrices = normalizeInsurerPrices(mdSettings?.insurerPrices);
  const encounterInsurerRows = await client.service('encounters').find({
    query: {
      medicId: user.id,
      insurerId: { $ne: null },
      $select: ['insurerId'],
      $limit: 10000,
    },
    paginate: false,
  });
  const studyInsurerRows = await client.service('studies').find({
    query: {
      medicId: user.id,
      insurerId: { $ne: null },
      $select: ['insurerId'],
      $limit: 10000,
    },
    paginate: false,
  });

  const insurerIds = [
    ...new Set(
      [
        ...Object.keys(insurerPrices),
        ...(Array.isArray(encounterInsurerRows) ? encounterInsurerRows : []).map(
          row => (row as { insurerId?: string | null }).insurerId
        ),
        ...(Array.isArray(studyInsurerRows) ? studyInsurerRows : []).map(
          row => (row as { insurerId?: string | null }).insurerId
        ),
      ].filter((id): id is string => Boolean(id))
    ),
  ];

  const insurersResponse = insurerIds.length
    ? await client.service('prepagas').find({
        query: { id: { $in: insurerIds }, $limit: insurerIds.length },
        paginate: false,
      })
    : [];

  const insurersList = Array.isArray(insurersResponse)
    ? insurersResponse
    : ((insurersResponse as { data?: unknown[] }).data ?? []);
  const insurerById = new Map((insurersList as Prepaga[]).map(item => [item.id, item]));

  const insurers = insurerIds
    .map(id => {
      const insurer = insurerById.get(id);
      return {
        id,
        shortName: insurer?.shortName || 'UNKNOWN',
        denomination: insurer?.denomination || id,
      };
    })
    .sort((a, b) => a.shortName.localeCompare(b.shortName));

  return json({
    mdSettingsId: mdSettings?.id ?? null,
    insurerPrices,
    insurers,
  });
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const formData = await request.formData();
  const payload = parseFormJson<{ insurerPrices?: unknown }>(formData.get('payload'));

  const settingsResponse = await client.service('md-settings').find({
    query: { userId: user.id, $limit: 1 },
    paginate: false,
  });
  const settingsList = Array.isArray(settingsResponse)
    ? settingsResponse
    : ((settingsResponse as { data?: unknown[] }).data ?? []);
  const mdSettings = settingsList[0] as { id: string } | undefined;

  if (!mdSettings?.id) {
    return json({ ok: false, error: 'Doctor settings were not found.' }, { status: 400 });
  }

  const insurerPrices = normalizeInsurerPrices(payload.insurerPrices);
  await client.service('md-settings').patch(mdSettings.id, { insurerPrices });

  return json({ ok: true });
};

export default function AccountingSettingsPage() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [insurerPrices, setInsurerPrices] = useState<InsurerPrices>(data.insurerPrices);
  const [insurers, setInsurers] = useState<Prepaga[]>(data.insurers as Prepaga[]);
  const [activeInsurerId, setActiveInsurerId] = useState<string | null>(data.insurers[0]?.id ?? null);
  const [pendingInsurance, setPendingInsurance] = useState('');

  const isSaving = fetcher.state !== 'idle';

  const activeInsurer = useMemo(
    () => insurers.find(insurer => insurer.id === activeInsurerId) ?? null,
    [activeInsurerId, insurers]
  );

  const activePrices = useMemo(
    () => (activeInsurerId ? (insurerPrices[activeInsurerId] ?? {}) : {}),
    [activeInsurerId, insurerPrices]
  );

  const handleSave = useCallback(() => {
    fetcher.submit({ payload: JSON.stringify({ insurerPrices }) }, { method: 'post' });
  }, [fetcher, insurerPrices]);

  const handleSelectInsurer = useCallback((insurerId: string) => {
    setActiveInsurerId(insurerId);
  }, []);

  const getPracticeConfig = useCallback(
    (practiceKey: string): PricingConfig => toPricingConfig(activePrices[practiceKey]),
    [activePrices]
  );

  const handleRemoveInsurer = useCallback(
    (insurerId: string) => {
      setInsurerPrices(prev => {
        const next = { ...prev };
        delete next[insurerId];
        return next;
      });
      setInsurers(prev => prev.filter(insurer => insurer.id !== insurerId));
      if (activeInsurerId === insurerId) {
        setActiveInsurerId(null);
      }
    },
    [activeInsurerId]
  );

  const handleAddInsurer = useCallback((prepaga: Prepaga) => {
    setInsurers(prev => {
      const exists = prev.some(item => item.id === prepaga.id);
      if (exists) {
        return prev;
      }

      return [...prev, prepaga];
    });
    setInsurerPrices(prev => ({ ...prev, [prepaga.id]: prev[prepaga.id] ?? {} }));
    setActiveInsurerId(prepaga.id);
    setPendingInsurance('');
  }, []);

  const handlePriceTypeChange = useCallback(
    (practiceKey: string, value: string | null) => {
      if (!activeInsurerId) {
        return;
      }
      const type = value === 'multiplier' ? 'multiplier' : 'fixed';
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            type,
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handlePracticeCodeChange = useCallback(
    (practiceKey: string, value: string) => {
      if (!activeInsurerId) {
        return;
      }
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            code: value,
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handlePracticeFixedValueChange = useCallback(
    (practiceKey: string, value: string | number) => {
      if (!activeInsurerId) {
        return;
      }
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            type: 'fixed',
            value: toNumericPrice(value),
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handlePracticeBaseNameChange = useCallback(
    (practiceKey: string, value: string) => {
      if (!activeInsurerId) {
        return;
      }
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            baseName: value,
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handlePracticeBaseValueChange = useCallback(
    (practiceKey: string, value: string | number) => {
      if (!activeInsurerId) {
        return;
      }
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            type: 'multiplier',
            baseValue: toNumericPrice(value),
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handlePracticeMultiplierChange = useCallback(
    (practiceKey: string, value: string | number) => {
      if (!activeInsurerId) {
        return;
      }
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            type: 'multiplier',
            multiplier: toNumericPrice(value),
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const getSelectInsurerHandler = useCallback(
    (insurerId: string) => () => {
      handleSelectInsurer(insurerId);
    },
    [handleSelectInsurer]
  );

  const getRemoveInsurerHandler = useCallback(
    (insurerId: string) => () => {
      handleRemoveInsurer(insurerId);
    },
    [handleRemoveInsurer]
  );

  const getTypeChangeHandler = useCallback(
    (practiceKey: string) => (value: string | null) => {
      handlePriceTypeChange(practiceKey, value);
    },
    [handlePriceTypeChange]
  );

  const getCodeChangeHandler = useCallback(
    (practiceKey: string) => (event: ChangeEvent<HTMLInputElement>) => {
      handlePracticeCodeChange(practiceKey, event.currentTarget.value);
    },
    [handlePracticeCodeChange]
  );

  const getFixedValueChangeHandler = useCallback(
    (practiceKey: string) => (value: string | number) => {
      handlePracticeFixedValueChange(practiceKey, value);
    },
    [handlePracticeFixedValueChange]
  );

  const getBaseNameChangeHandler = useCallback(
    (practiceKey: string) => (event: ChangeEvent<HTMLInputElement>) => {
      handlePracticeBaseNameChange(practiceKey, event.currentTarget.value);
    },
    [handlePracticeBaseNameChange]
  );

  const getBaseValueChangeHandler = useCallback(
    (practiceKey: string) => (value: string | number) => {
      handlePracticeBaseValueChange(practiceKey, value);
    },
    [handlePracticeBaseValueChange]
  );

  const getMultiplierChangeHandler = useCallback(
    (practiceKey: string) => (value: string | number) => {
      handlePracticeMultiplierChange(practiceKey, value);
    },
    [handlePracticeMultiplierChange]
  );

  return (
    <Layout>
      <Portal id="toolbar">
        <ToolbarTitle title={t('navigation.accounting_settings', { defaultValue: 'Accounting Settings' })} />
      </Portal>

      <Sidebar>
        <Title order={4}>{t('navigation.insurers', { defaultValue: 'Insurers' })}</Title>
        <PrepagaSelector
          value={pendingInsurance}
          onChange={setPendingInsurance}
          onSelectPrepaga={handleAddInsurer}
          placeholder={t('forms.type_to_search_prepagas')}
        />
        <SidebarList>
          {insurers.map(insurer => (
            <Group key={insurer.id} justify="space-between" wrap="nowrap">
              <Button
                variant={activeInsurerId === insurer.id ? 'filled' : 'light'}
                fullWidth
                justify="flex-start"
                onClick={getSelectInsurerHandler(insurer.id)}
              >
                {insurer.shortName}
              </Button>
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={getRemoveInsurerHandler(insurer.id)}
                aria-label={t('common.delete')}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Group>
          ))}
        </SidebarList>
      </Sidebar>

      <Paper withBorder p="lg">
        {!activeInsurer && (
          <Text c="dimmed">{t('common.no_results', { defaultValue: 'No insurers configured yet.' })}</Text>
        )}
        {activeInsurer && (
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={3}>{activeInsurer.shortName}</Title>
              <Button onClick={handleSave} loading={isSaving}>
                {t('common.save')}
              </Button>
            </Group>
            {ACCOUNTING_PRACTICE_KEYS.map(practiceKey => (
              <Paper key={practiceKey} withBorder p="md">
                <Stack gap="sm">
                  <Text fw={600}>{practiceLabelByKey[practiceKey] ?? practiceKey}</Text>
                  <Select
                    label="Pricing type"
                    data={[
                      { value: 'fixed', label: 'Fixed price' },
                      { value: 'multiplier', label: 'Multiplier' },
                    ]}
                    value={getPracticeConfig(practiceKey).type}
                    onChange={getTypeChangeHandler(practiceKey)}
                  />
                  <TextInput
                    label="Practice code"
                    value={getPracticeConfig(practiceKey).code ?? ''}
                    onChange={getCodeChangeHandler(practiceKey)}
                    placeholder="e.g. 210210"
                  />

                  {getPracticeConfig(practiceKey).type === 'fixed' && (
                    <NumberInput
                      label="Price"
                      decimalScale={2}
                      min={0}
                      fixedDecimalScale
                      value={getPracticeConfig(practiceKey).value ?? 0}
                      onChange={getFixedValueChangeHandler(practiceKey)}
                      thousandSeparator=","
                    />
                  )}

                  {getPracticeConfig(practiceKey).type === 'multiplier' && (
                    <Stack gap="sm">
                      <TextInput
                        label="Base value name"
                        value={getPracticeConfig(practiceKey).baseName ?? ''}
                        onChange={getBaseNameChangeHandler(practiceKey)}
                        placeholder="e.g. UHB"
                      />
                      <NumberInput
                        label="Base value amount"
                        decimalScale={2}
                        min={0}
                        fixedDecimalScale
                        value={getPracticeConfig(practiceKey).baseValue ?? 0}
                        onChange={getBaseValueChangeHandler(practiceKey)}
                        thousandSeparator=","
                      />
                      <NumberInput
                        label="Multiplier"
                        decimalScale={2}
                        min={0}
                        value={getPracticeConfig(practiceKey).multiplier ?? 1}
                        onChange={getMultiplierChangeHandler(practiceKey)}
                      />
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Layout>
  );
}
