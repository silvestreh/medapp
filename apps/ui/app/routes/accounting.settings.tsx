import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import { Button, Group, NumberInput, Paper, Select, Stack, Text, TextInput, Title, Input } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { authenticatedLoader, getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { ToolbarTitle } from '~/components/toolbar-title';
import {
  ACCOUNTING_PRACTICE_KEYS,
  PARTICULAR_INSURER_ID,
  toPricingConfig,
  normalizeInsurerPrices,
  toNumericPrice,
  type PricingConfig,
  type PricingType,
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

    md: {
      gridTemplateColumns: '320px 1fr',
    },
  },
});

const Sidebar = styled('div', {
  base: {
    backgroundColor: 'white',
    borderRight: '1px solid var(--mantine-color-gray-3)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minHeight: 'calc(100vh - 5rem)',
    maxHeight: 'calc(100vh - 5rem)',
    position: 'sticky',
    top: '5rem',
    overflowY: 'auto',
  },
});

const SidebarList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
  },
});

const practiceI18nKey = {
  encounter: 'accounting.kind_encounter',
  anemia: 'accounting.type_anemia',
  anticoagulation: 'accounting.type_anticoagulation',
  compatibility: 'accounting.type_compatibility',
  hemostasis: 'accounting.type_hemostasis',
  myelogram: 'accounting.type_myelogram',
  thrombophilia: 'accounting.type_thrombophilia',
} as const;

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

  const dbInsurerIds: string[] = await (client.service('accounting') as any).get('insurers', {
    query: { medicId: user.id },
  });

  const allInsurerIds = [
    ...new Set([...Object.keys(insurerPrices), ...(Array.isArray(dbInsurerIds) ? dbInsurerIds : [])]),
  ];
  const realInsurerIds = allInsurerIds.filter(id => id !== PARTICULAR_INSURER_ID);

  const insurersResponse = realInsurerIds.length
    ? await client.service('prepagas').find({
        query: { id: { $in: realInsurerIds }, $limit: realInsurerIds.length },
        paginate: false,
      })
    : [];

  const insurersList = Array.isArray(insurersResponse)
    ? insurersResponse
    : ((insurersResponse as { data?: unknown[] }).data ?? []);
  const insurerById = new Map((insurersList as Prepaga[]).map(item => [item.id, item]));

  const insurers = [
    { id: PARTICULAR_INSURER_ID, shortName: 'Particular', denomination: 'Particular' },
    ...realInsurerIds
      .map(id => {
        const insurer = insurerById.get(id);
        return {
          id,
          shortName: insurer?.shortName || 'UNKNOWN',
          denomination: insurer?.denomination || id,
        };
      })
      .sort((a, b) => a.shortName.localeCompare(b.shortName)),
  ];

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

  const isSaving = fetcher.state !== 'idle';

  const activeInsurer = useMemo(
    () => insurers.find(insurer => insurer.id === activeInsurerId) ?? null,
    [activeInsurerId, insurers]
  );

  const activePrices = useMemo(
    () => (activeInsurerId ? (insurerPrices[activeInsurerId] ?? {}) : {}),
    [activeInsurerId, insurerPrices]
  );

  const activeInsurerType: PricingType = useMemo(() => {
    if (!activeInsurerId) return 'fixed';
    const practices = insurerPrices[activeInsurerId] ?? {};
    const first = Object.values(practices)[0];
    return first ? toPricingConfig(first).type : 'fixed';
  }, [activeInsurerId, insurerPrices]);

  const activeInsurerBaseName = useMemo(() => {
    if (!activeInsurerId) return '';
    const practices = insurerPrices[activeInsurerId] ?? {};
    const first = Object.values(practices)[0];
    return first ? (toPricingConfig(first).baseName ?? '') : '';
  }, [activeInsurerId, insurerPrices]);

  const activeInsurerBaseValue = useMemo(() => {
    if (!activeInsurerId) return 0;
    const practices = insurerPrices[activeInsurerId] ?? {};
    const first = Object.values(practices)[0];
    return first ? (toPricingConfig(first).baseValue ?? 0) : 0;
  }, [activeInsurerId, insurerPrices]);

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

  const handleInsurerTypeChange = useCallback(
    (value: string | null) => {
      if (!activeInsurerId) {
        return;
      }
      const type: PricingType = value === 'multiplier' ? 'multiplier' : 'fixed';
      setInsurerPrices(prev => {
        const current = prev[activeInsurerId] ?? {};
        const updated: Record<string, PricingConfig> = {};
        for (const key of ACCOUNTING_PRACTICE_KEYS) {
          updated[key] = { ...toPricingConfig(current[key]), type };
        }
        return { ...prev, [activeInsurerId]: updated };
      });
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
            value: toNumericPrice(value),
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handleInsurerBaseNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!activeInsurerId) {
        return;
      }
      const baseName = event.currentTarget.value;
      setInsurerPrices(prev => {
        const current = prev[activeInsurerId] ?? {};
        const updated: Record<string, PricingConfig> = {};
        for (const key of ACCOUNTING_PRACTICE_KEYS) {
          updated[key] = { ...toPricingConfig(current[key]), baseName };
        }
        return { ...prev, [activeInsurerId]: updated };
      });
    },
    [activeInsurerId]
  );

  const handleInsurerBaseValueChange = useCallback(
    (value: string | number) => {
      if (!activeInsurerId) {
        return;
      }
      const baseValue = toNumericPrice(value);
      setInsurerPrices(prev => {
        const current = prev[activeInsurerId] ?? {};
        const updated: Record<string, PricingConfig> = {};
        for (const key of ACCOUNTING_PRACTICE_KEYS) {
          updated[key] = { ...toPricingConfig(current[key]), baseValue };
        }
        return { ...prev, [activeInsurerId]: updated };
      });
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

  const getMultiplierChangeHandler = useCallback(
    (practiceKey: string) => (value: string | number) => {
      handlePracticeMultiplierChange(practiceKey, value);
    },
    [handlePracticeMultiplierChange]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      if (value.length > 0) {
        const filteredInsurers = data.insurers.filter((insurer: Prepaga) =>
          insurer.shortName.toLowerCase().includes(value.toLowerCase())
        );
        setInsurers(filteredInsurers);
      } else {
        setInsurers(data.insurers);
      }
    },
    [data.insurers]
  );

  return (
    <Layout>
      <Portal id="toolbar">
        <ToolbarTitle title={t('navigation.accounting_settings', { defaultValue: 'Accounting Settings' })} />
      </Portal>

      <Portal id="form-actions">
        <Group justify="flex-end" flex={1}>
          <Text c="dimmed">{t('accounting.settings_pricing_type')}</Text>
          <Select
            data={[
              { value: 'fixed', label: t('accounting.settings_fixed_price') },
              { value: 'multiplier', label: t('accounting.settings_multiplier') },
            ]}
            value={activeInsurerType}
            onChange={handleInsurerTypeChange}
            style={{ width: '120px' }}
          />
          {activeInsurerType === 'multiplier' && (
            <>
              <TextInput
                // label="Base value name"
                value={activeInsurerBaseName}
                onChange={handleInsurerBaseNameChange}
                placeholder={t('accounting.settings_base_name_placeholder')}
                style={{ width: '120px' }}
              />
              <NumberInput
                // label="Base value amount"
                decimalScale={2}
                min={0}
                fixedDecimalScale
                value={activeInsurerBaseValue}
                onChange={handleInsurerBaseValueChange}
                thousandSeparator=","
                style={{ width: '120px' }}
              />
            </>
          )}
          <Button onClick={handleSave} loading={isSaving}>
            {t('common.save')}
          </Button>
        </Group>
      </Portal>

      <Sidebar>
        <Input
          placeholder={t('accounting.settings_search_insurers')}
          variant="unstyled"
          size="lg"
          leftSection={<Search size={16} />}
          onChange={event => handleSearchChange(event.currentTarget.value)}
          styles={{
            wrapper: {
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            },
            input: {
              fontSize: '1rem',
            },
          }}
        />
        <SidebarList>
          {insurers.map(insurer => (
            <Button
              key={insurer.id}
              variant={activeInsurerId === insurer.id ? 'filled' : 'transparent'}
              fullWidth
              justify="flex-start"
              onClick={getSelectInsurerHandler(insurer.id)}
              style={{ borderRadius: 0 }}
            >
              {insurer.id === PARTICULAR_INSURER_ID ? t('accounting.settings_particular') : insurer.shortName}
            </Button>
          ))}
        </SidebarList>
      </Sidebar>

      <Paper variant="unstyled" bg="transparent" p="2rem">
        {!activeInsurer && (
          <Text c="dimmed">{t('common.no_results', { defaultValue: 'No insurers configured yet.' })}</Text>
        )}
        {activeInsurer && (
          <Stack gap="0">
            <Group justify="space-between" mb="md">
              <Stack gap="0">
                <Title>
                  {activeInsurer.id === PARTICULAR_INSURER_ID
                    ? t('accounting.settings_particular')
                    : activeInsurer.shortName}
                </Title>
                <Text>
                  {activeInsurer.id === PARTICULAR_INSURER_ID
                    ? t('accounting.settings_particular')
                    : activeInsurer.denomination}
                </Text>
              </Stack>
            </Group>
            {ACCOUNTING_PRACTICE_KEYS.map((practiceKey, index, array) => (
              <Paper
                key={practiceKey}
                withBorder
                p="md"
                style={{
                  borderRadius:
                    index === 0 ? '0.5rem 0.5rem 0 0' : index === array.length - 1 ? '0 0 0.5rem 0.5rem' : '0',
                  borderBottomWidth: index !== array.length - 1 ? 0 : 1,
                }}
              >
                <Stack gap={0}>
                  <Text c="blue.4" fw={600}>
                    {t(practiceI18nKey[practiceKey])}
                  </Text>
                  <Group justify="stretch">
                    <TextInput
                      label={t('accounting.settings_practice_code')}
                      value={getPracticeConfig(practiceKey).code ?? ''}
                      onChange={getCodeChangeHandler(practiceKey)}
                      placeholder={t('accounting.settings_practice_code_placeholder')}
                      flex={1}
                      styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                    />

                    {activeInsurerType === 'fixed' && (
                      <NumberInput
                        label={t('accounting.settings_price')}
                        decimalScale={2}
                        min={0}
                        fixedDecimalScale
                        value={getPracticeConfig(practiceKey).value ?? 0}
                        onChange={getFixedValueChangeHandler(practiceKey)}
                        thousandSeparator=","
                        flex={1}
                        styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                      />
                    )}

                    {activeInsurerType === 'multiplier' && (
                      <NumberInput
                        label={t('accounting.settings_units')}
                        decimalScale={2}
                        min={0}
                        value={getPracticeConfig(practiceKey).multiplier ?? 1}
                        onChange={getMultiplierChangeHandler(practiceKey)}
                        flex={1}
                        styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                      />
                    )}
                  </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Layout>
  );
}
