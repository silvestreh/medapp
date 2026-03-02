import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import {
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Input,
  Switch,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { authenticatedLoader, getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
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
import { studySchemas, getExtraCostSections, type ExtraCostSection } from '@medapp/encounter-schemas';
import { parseFormJson } from '~/utils/parse-form-json';
import { styled } from '~/styled-system/jsx';

const extraCostSectionsByPractice: Record<string, ExtraCostSection[]> = {};
for (const [studyName, schema] of Object.entries(studySchemas)) {
  const sections = getExtraCostSections(schema);
  if (sections.length > 0) {
    extraCostSectionsByPractice[studyName] = sections;
  }
}

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

export const loader = authenticatedLoader(async ({ request, params }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const { medicId } = params;

  if (!medicId) {
    throw new Response('Medic ID is required', { status: 400 });
  }

  const acctSettingsResponse = await client.service('accounting-settings').find({
    query: { userId: medicId, $limit: 1 },
    paginate: false,
  });

  const acctSettingsList = Array.isArray(acctSettingsResponse)
    ? acctSettingsResponse
    : ((acctSettingsResponse as { data?: unknown[] }).data ?? []);
  const acctSettings = acctSettingsList[0] as
    | { id: string; insurerPrices?: unknown; hiddenInsurers?: string[] }
    | undefined;
  const insurerPrices = normalizeInsurerPrices(acctSettings?.insurerPrices);
  const hiddenInsurers = Array.isArray(acctSettings?.hiddenInsurers) ? acctSettings.hiddenInsurers : [];

  const dbInsurerIds: string[] = await (client.service('accounting') as any).get('insurers', {
    query: { medicId: medicId },
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
    acctSettingsId: acctSettings?.id ?? null,
    insurerPrices,
    insurers,
    hiddenInsurers,
  });
});

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const { medicId } = params;
  const formData = await request.formData();
  const payload = parseFormJson<{ insurerPrices?: unknown; hiddenInsurers?: string[] }>(formData.get('payload'));

  if (!medicId) {
    throw new Response('Medic ID is required', { status: 400 });
  }

  const acctSettingsResponse = await client.service('accounting-settings').find({
    query: { userId: medicId, $limit: 1 },
    paginate: false,
  });
  const acctSettingsList = Array.isArray(acctSettingsResponse)
    ? acctSettingsResponse
    : ((acctSettingsResponse as { data?: unknown[] }).data ?? []);
  const acctSettings = acctSettingsList[0] as { id: string } | undefined;

  const insurerPrices = normalizeInsurerPrices(payload.insurerPrices);
  const hiddenInsurers = Array.isArray(payload.hiddenInsurers) ? payload.hiddenInsurers : [];

  if (acctSettings?.id) {
    await client.service('accounting-settings').patch(acctSettings.id, { insurerPrices, hiddenInsurers });
  } else {
    await client.service('accounting-settings').create({
      userId: medicId,
      insurerPrices,
      hiddenInsurers,
    } as any);
  }

  return json({ ok: true });
};

export default function AccountingSettingsPage() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [insurerPrices, setInsurerPrices] = useState<InsurerPrices>(data.insurerPrices);
  const [insurers, setInsurers] = useState<Prepaga[]>(data.insurers as Prepaga[]);
  const [activeInsurerId, setActiveInsurerId] = useState<string | null>(data.insurers[0]?.id ?? null);
  const [pricingMode, setPricingMode] = useState<'normal' | 'emergency'>('normal');
  const [hiddenInsurers, setHiddenInsurers] = useState<string[]>(data.hiddenInsurers || []);

  const isSaving = fetcher.state !== 'idle';

  const activeInsurer = useMemo(
    () => insurers.find(insurer => insurer.id === activeInsurerId) ?? null,
    [activeInsurerId, insurers]
  );

  const activePrices = useMemo(
    () => (activeInsurerId ? (insurerPrices[activeInsurerId] ?? {}) : {}),
    [activeInsurerId, insurerPrices]
  );

  const hasAnyMultiplier = useMemo(() => {
    if (!activeInsurerId) return false;
    const practices = insurerPrices[activeInsurerId] ?? {};
    return Object.values(practices).some(p => toPricingConfig(p).type === 'multiplier');
  }, [activeInsurerId, insurerPrices]);

  const activeInsurerBaseName = useMemo(() => {
    if (!activeInsurerId) return '';
    const practices = insurerPrices[activeInsurerId] ?? {};
    const multiplierPractice = Object.values(practices).find(p => toPricingConfig(p).type === 'multiplier');
    return multiplierPractice ? (toPricingConfig(multiplierPractice).baseName ?? '') : '';
  }, [activeInsurerId, insurerPrices]);

  const activeInsurerBaseValue = useMemo(() => {
    if (!activeInsurerId) return 0;
    const practices = insurerPrices[activeInsurerId] ?? {};
    const multiplierPractice = Object.values(practices).find(p => toPricingConfig(p).type === 'multiplier');
    return multiplierPractice ? (toPricingConfig(multiplierPractice).baseValue ?? 0) : 0;
  }, [activeInsurerId, insurerPrices]);

  const handleSave = useCallback(() => {
    fetcher.submit({ payload: JSON.stringify({ insurerPrices, hiddenInsurers }) }, { method: 'post' });
  }, [fetcher, insurerPrices, hiddenInsurers]);

  const handleSelectInsurer = useCallback((insurerId: string) => {
    setActiveInsurerId(insurerId);
  }, []);

  const handleToggleVisibility = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!activeInsurerId) return;
      const isHidden = !event.currentTarget.checked;
      setHiddenInsurers(prev => {
        if (isHidden) {
          return [...prev, activeInsurerId];
        }
        return prev.filter(id => id !== activeInsurerId);
      });
    },
    [activeInsurerId]
  );

  const getPracticeConfig = useCallback(
    (practiceKey: string): PricingConfig => toPricingConfig(activePrices[practiceKey]),
    [activePrices]
  );

  const handlePracticeTypeChange = useCallback(
    (practiceKey: string, value: string | null) => {
      if (!activeInsurerId) return;
      const type: PricingType = value === 'multiplier' ? 'multiplier' : 'fixed';
      setInsurerPrices(prev => {
        const current = prev[activeInsurerId] ?? {};
        const practiceConfig = toPricingConfig(current[practiceKey]);
        const patch: Partial<PricingConfig> = { type };

        if (type === 'multiplier' && !practiceConfig.baseName && !practiceConfig.baseValue) {
          const existing = Object.values(current)
            .map(toPricingConfig)
            .find(c => c.type === 'multiplier');
          if (existing) {
            patch.baseName = existing.baseName;
            patch.baseValue = existing.baseValue;
          }
        }

        return {
          ...prev,
          [activeInsurerId]: {
            ...current,
            [practiceKey]: { ...practiceConfig, ...patch },
          },
        };
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
      if (!activeInsurerId) return;
      const baseName = event.currentTarget.value;
      setInsurerPrices(prev => {
        const current = prev[activeInsurerId] ?? {};
        const updated: Record<string, PricingConfig> = {};
        for (const key of ACCOUNTING_PRACTICE_KEYS) {
          const cfg = toPricingConfig(current[key]);
          updated[key] = cfg.type === 'multiplier' ? { ...cfg, baseName } : cfg;
        }
        return { ...prev, [activeInsurerId]: updated };
      });
    },
    [activeInsurerId]
  );

  const handleInsurerBaseValueChange = useCallback(
    (value: string | number) => {
      if (!activeInsurerId) return;
      const baseValue = toNumericPrice(value);
      setInsurerPrices(prev => {
        const current = prev[activeInsurerId] ?? {};
        const updated: Record<string, PricingConfig> = {};
        for (const key of ACCOUNTING_PRACTICE_KEYS) {
          const cfg = toPricingConfig(current[key]);
          updated[key] = cfg.type === 'multiplier' ? { ...cfg, baseValue } : cfg;
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

  const handleEmergencyFixedValueChange = useCallback(
    (practiceKey: string, value: string | number) => {
      if (!activeInsurerId) return;
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            emergencyValue: toNumericPrice(value),
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handleEmergencyMultiplierChange = useCallback(
    (practiceKey: string, value: string | number) => {
      if (!activeInsurerId) return;
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: {
            ...toPricingConfig(prev[activeInsurerId]?.[practiceKey]),
            emergencyMultiplier: toNumericPrice(value),
          },
        },
      }));
    },
    [activeInsurerId]
  );

  const handleEmergencyExtraCostChange = useCallback(
    (practiceKey: string, sectionName: string, value: string | number) => {
      if (!activeInsurerId) return;
      setInsurerPrices(prev => {
        const current = toPricingConfig(prev[activeInsurerId]?.[practiceKey]);
        return {
          ...prev,
          [activeInsurerId]: {
            ...(prev[activeInsurerId] ?? {}),
            [practiceKey]: {
              ...current,
              emergencyExtras: {
                ...current.emergencyExtras,
                [sectionName]: toNumericPrice(value),
              },
            },
          },
        };
      });
    },
    [activeInsurerId]
  );

  const handleExtraCostChange = useCallback(
    (practiceKey: string, sectionName: string, value: string | number) => {
      if (!activeInsurerId) {
        return;
      }
      setInsurerPrices(prev => {
        const current = toPricingConfig(prev[activeInsurerId]?.[practiceKey]);
        return {
          ...prev,
          [activeInsurerId]: {
            ...(prev[activeInsurerId] ?? {}),
            [practiceKey]: {
              ...current,
              extras: {
                ...current.extras,
                [sectionName]: toNumericPrice(value),
              },
            },
          },
        };
      });
    },
    [activeInsurerId]
  );

  const getExtraCostChangeHandler = useCallback(
    (practiceKey: string, sectionName: string) => (value: string | number) => {
      handleExtraCostChange(practiceKey, sectionName, value);
    },
    [handleExtraCostChange]
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

  const getEmergencyFixedValueChangeHandler = useCallback(
    (practiceKey: string) => (value: string | number) => {
      handleEmergencyFixedValueChange(practiceKey, value);
    },
    [handleEmergencyFixedValueChange]
  );

  const getEmergencyMultiplierChangeHandler = useCallback(
    (practiceKey: string) => (value: string | number) => {
      handleEmergencyMultiplierChange(practiceKey, value);
    },
    [handleEmergencyMultiplierChange]
  );

  const getEmergencyExtraCostChangeHandler = useCallback(
    (practiceKey: string, sectionName: string) => (value: string | number) => {
      handleEmergencyExtraCostChange(practiceKey, sectionName, value);
    },
    [handleEmergencyExtraCostChange]
  );

  const getTypeChangeHandler = useCallback(
    (practiceKey: string) => (value: string | null) => {
      handlePracticeTypeChange(practiceKey, value);
    },
    [handlePracticeTypeChange]
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
      <Portal id="form-actions">
        <Group justify="flex-end" flex={1}>
          {hasAnyMultiplier && (
            <>
              <TextInput
                value={activeInsurerBaseName}
                onChange={handleInsurerBaseNameChange}
                placeholder={t('accounting.settings_base_name_placeholder')}
                style={{ width: '120px' }}
              />
              <NumberInput
                decimalScale={2}
                min={0}
                fixedDecimalScale
                value={activeInsurerBaseValue}
                onChange={handleInsurerBaseValueChange}
                thousandSeparator=","
                style={{ width: '120px' }}
                prefix="$"
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
              style={{ borderRadius: 0, opacity: hiddenInsurers.includes(insurer.id) ? 0.5 : 1 }}
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
              <Switch
                label={t('accounting.settings_visible', { defaultValue: 'Visible' })}
                checked={!hiddenInsurers.includes(activeInsurer.id)}
                onChange={handleToggleVisibility}
              />
            </Group>

            <SegmentedControl
              value={pricingMode}
              onChange={v => setPricingMode(v as 'normal' | 'emergency')}
              data={[
                { label: t('accounting.settings_normal'), value: 'normal' },
                { label: t('accounting.settings_emergency'), value: 'emergency' },
              ]}
              mb="md"
            />

            {ACCOUNTING_PRACTICE_KEYS.filter(key => pricingMode === 'normal' || key !== 'encounter').map(
              (practiceKey, index, array) => {
                const config = getPracticeConfig(practiceKey);
                const practiceType = config.type;

                return (
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
                      <Group justify="space-between" align="center">
                        <Text c="blue.4" fw={600}>
                          {t(practiceI18nKey[practiceKey])}
                        </Text>
                        <Select
                          data={[
                            { value: 'fixed', label: t('accounting.settings_fixed_price') },
                            { value: 'multiplier', label: t('accounting.settings_multiplier') },
                          ]}
                          value={practiceType}
                          onChange={getTypeChangeHandler(practiceKey)}
                          size="xs"
                          style={{ width: '110px' }}
                        />
                      </Group>
                      <Group justify="stretch">
                        <TextInput
                          label={t('accounting.settings_practice_code')}
                          value={config.code ?? ''}
                          onChange={getCodeChangeHandler(practiceKey)}
                          placeholder={t('accounting.settings_practice_code_placeholder')}
                          flex={1}
                          styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                        />

                        {pricingMode === 'normal' && practiceType === 'fixed' && (
                          <NumberInput
                            label={t('accounting.settings_price')}
                            decimalScale={2}
                            min={0}
                            fixedDecimalScale
                            value={config.value ?? 0}
                            onChange={getFixedValueChangeHandler(practiceKey)}
                            thousandSeparator=","
                            flex={1}
                            styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                            prefix="$"
                          />
                        )}

                        {pricingMode === 'normal' && practiceType === 'multiplier' && (
                          <NumberInput
                            label={t('accounting.settings_units')}
                            decimalScale={2}
                            min={0}
                            value={config.multiplier ?? 1}
                            onChange={getMultiplierChangeHandler(practiceKey)}
                            flex={1}
                            styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                            suffix={` ${activeInsurerBaseName}`}
                          />
                        )}

                        {pricingMode === 'emergency' && practiceType === 'fixed' && (
                          <NumberInput
                            label={t('accounting.settings_price')}
                            decimalScale={2}
                            min={0}
                            fixedDecimalScale
                            value={config.emergencyValue ?? 0}
                            onChange={getEmergencyFixedValueChangeHandler(practiceKey)}
                            thousandSeparator=","
                            flex={1}
                            styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                            prefix="$"
                          />
                        )}

                        {pricingMode === 'emergency' && practiceType === 'multiplier' && (
                          <NumberInput
                            label={t('accounting.settings_units')}
                            decimalScale={2}
                            min={0}
                            value={config.emergencyMultiplier ?? 0}
                            onChange={getEmergencyMultiplierChangeHandler(practiceKey)}
                            flex={1}
                            styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                            suffix={` ${activeInsurerBaseName}`}
                          />
                        )}
                      </Group>
                      {(extraCostSectionsByPractice[practiceKey] ?? []).map(section => (
                        <Group key={section.name} justify="flex-end" mt="xs">
                          <Text c="dimmed" size="sm" flex={1} style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            {`${section.label.toLowerCase()}:`}
                          </Text>
                          {pricingMode === 'normal' && practiceType === 'fixed' && (
                            <NumberInput
                              decimalScale={2}
                              min={0}
                              fixedDecimalScale
                              value={config.extras?.[section.name] ?? 0}
                              onChange={getExtraCostChangeHandler(practiceKey, section.name)}
                              thousandSeparator=","
                              styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                              prefix="$"
                              flex={1}
                            />
                          )}
                          {pricingMode === 'normal' && practiceType === 'multiplier' && (
                            <NumberInput
                              decimalScale={2}
                              min={0}
                              value={config.extras?.[section.name] ?? 0}
                              onChange={getExtraCostChangeHandler(practiceKey, section.name)}
                              styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                              suffix={` ${activeInsurerBaseName}`}
                              flex={1}
                            />
                          )}
                          {pricingMode === 'emergency' && practiceType === 'fixed' && (
                            <NumberInput
                              decimalScale={2}
                              min={0}
                              fixedDecimalScale
                              value={config.emergencyExtras?.[section.name] ?? 0}
                              onChange={getEmergencyExtraCostChangeHandler(practiceKey, section.name)}
                              thousandSeparator=","
                              styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                              prefix="$"
                              flex={1}
                            />
                          )}
                          {pricingMode === 'emergency' && practiceType === 'multiplier' && (
                            <NumberInput
                              decimalScale={2}
                              min={0}
                              value={config.emergencyExtras?.[section.name] ?? 0}
                              onChange={getEmergencyExtraCostChangeHandler(practiceKey, section.name)}
                              styles={{ label: { color: 'var(--mantine-color-gray-6)' } }}
                              suffix={` ${activeInsurerBaseName}`}
                              flex={1}
                            />
                          )}
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                );
              }
            )}
          </Stack>
        )}
      </Paper>
    </Layout>
  );
}
