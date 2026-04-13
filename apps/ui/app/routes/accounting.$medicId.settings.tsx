import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData, useParams } from '@remix-run/react';
import {
  ActionIcon,
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
  Divider,
  Flex,
  Popover,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ClockCounterClockwiseIcon,
  CaretDownIcon,
  ArrowLeftIcon,
} from '@phosphor-icons/react';

import { showNotification } from '@mantine/notifications';
import Joyride from 'react-joyride';

import { authenticatedLoader, getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { useSectionTour } from '~/components/guided-tour/use-section-tour';
import { getAccountingSettingsSteps } from '~/components/guided-tour/tour-steps/accounting-settings-steps';
import TourTooltip from '~/components/guided-tour/tour-tooltip';
import {
  ACCOUNTING_PRACTICE_KEYS,
  PARTICULAR_INSURER_ID,
  toPricingConfig,
  normalizeInsurerPrices,
  toNumericPrice,
  type PricingConfig,
  type PricingType,
  type InsurerPrices,
  type TierPriceOverride,
} from '~/utils/accounting';
import { studySchemas, getExtraCostSections, type ExtraCostSection } from '@athelas/encounter-schemas';
import { parseFormJson } from '~/utils/parse-form-json';
import { styled } from '~/styled-system/jsx';
import { useFeathers } from '~/components/provider';
import { PracticeCodeInput } from '~/components/practices/practice-code-input';
import { PrepagaSelector } from '~/components/prepaga-selector';
import { DateRangePopover, resolveDateRange, type DateRangeFilterState } from '~/components/date-range-popover';

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
  tiers: { name: string; code: number | null }[];
};

const Layout = styled('div', {
  base: {
    display: 'flex',
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

    lg: {
      width: '250px',
    },
  },
});

const SidebarList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    mt: '-2',
  },
});

const Content = styled('div', {
  base: {
    flex: 1,
    padding: '1rem',

    lg: {
      padding: '2rem',
    },
  },
});

const InsurerName = styled('div', {
  base: {
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    maxWidth: '30vw',
  },
});

const InsurerFilter = styled('div', {
  base: {
    p: '1rem',
    borderTop: '1px solid var(--mantine-color-gray-2)',
    position: 'sticky',
    bottom: 0,
    backgroundColor: 'white',
    marginTop: 'auto',
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

  const [dbInsurerIds, allHistoricalInsurerIds]: [string[], string[]] = await Promise.all([
    (client.service('accounting') as any).get('insurers', { query: { medicId } }),
    (client.service('accounting') as any).get('all-insurers', { query: { medicId } }),
  ]);

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

  // Fetch practices and practice-codes
  let allPractices: { id: string; title: string; systemKey: string | null; isSystem: boolean }[] = [];
  let practiceCodes: { codeId: string; practiceId: string; insurerId: string; code: string }[] = [];
  try {
    const [practicesResponse, codesResponse] = await Promise.all([
      client.service('practices' as any).find({ query: { $limit: 200 } }),
      client.service('practice-codes' as any).find({ query: { userId: medicId, $limit: 500 } }),
    ]);
    const practicesList = Array.isArray(practicesResponse)
      ? practicesResponse
      : ((practicesResponse as any)?.data ?? []);
    allPractices = practicesList.map((p: any) => ({
      id: p.id,
      title: p.title,
      systemKey: p.systemKey,
      isSystem: p.isSystem,
    }));
    const codesList = Array.isArray(codesResponse) ? codesResponse : ((codesResponse as any)?.data ?? []);
    practiceCodes = codesList.map((c: any) => ({
      codeId: c.id,
      practiceId: c.practiceId,
      insurerId: c.insurerId,
      code: c.code,
    }));
  } catch {
    // practices/practice-codes service may not exist yet
  }

  const customPractices = allPractices.filter(p => !p.isSystem);
  const customPracticeKeys = customPractices.map(p => `custom_${p.id}`);
  const normalizedPrices =
    customPracticeKeys.length > 0
      ? normalizeInsurerPrices(acctSettings?.insurerPrices, customPracticeKeys)
      : insurerPrices;

  // Build practice code lookup: practiceCodeMap[insurerId][practiceKey] = { code, practiceId, codeId }
  const practiceCodeMap: Record<string, Record<string, { code: string; practiceId: string; codeId: string }>> = {};
  // Also build practiceKey → practiceId map for creating new codes
  const practiceKeyToId: Record<string, string> = {};
  for (const p of allPractices) {
    const key = p.systemKey || `custom_${p.id}`;
    practiceKeyToId[key] = p.id;
  }
  for (const pc of practiceCodes) {
    const practice = allPractices.find(p => p.id === pc.practiceId);
    if (!practice) continue;
    const practiceKey = practice.systemKey || `custom_${practice.id}`;
    if (!practiceCodeMap[pc.insurerId]) practiceCodeMap[pc.insurerId] = {};
    practiceCodeMap[pc.insurerId][practiceKey] = { code: pc.code, practiceId: pc.practiceId, codeId: pc.codeId };
  }

  // Merge practice-code insurer IDs into the sidebar list
  const practiceCodeInsurerIds = [...new Set(practiceCodes.map(c => c.insurerId))];
  const mergedInsurerIds = [
    ...new Set([...realInsurerIds, ...practiceCodeInsurerIds.filter(id => id !== PARTICULAR_INSURER_ID)]),
  ];

  // Re-fetch any new insurers we didn't have before
  const missingInsurerIds = mergedInsurerIds.filter(id => !insurerById.has(id));
  if (missingInsurerIds.length > 0) {
    const extraResponse = await client.service('prepagas').find({
      query: { id: { $in: missingInsurerIds }, $limit: missingInsurerIds.length },
      paginate: false,
    });
    const extraList = Array.isArray(extraResponse)
      ? extraResponse
      : ((extraResponse as { data?: unknown[] }).data ?? []);
    for (const item of extraList as Prepaga[]) {
      insurerById.set(item.id, item);
    }
  }

  const finalInsurers = [
    {
      id: PARTICULAR_INSURER_ID,
      shortName: 'Particular',
      denomination: 'Particular',
      tiers: [] as { name: string; code: number | null }[],
    },
    ...mergedInsurerIds
      .map(id => {
        const insurer = insurerById.get(id);
        return {
          id,
          shortName: insurer?.shortName || 'UNKNOWN',
          denomination: insurer?.denomination || id,
          tiers: (insurer as any)?.tiers || [],
        };
      })
      .sort((a, b) => a.shortName.localeCompare(b.shortName)),
  ];

  return json({
    acctSettingsId: acctSettings?.id ?? null,
    insurerPrices: normalizedPrices,
    insurers: finalInsurers,
    hiddenInsurers,
    allHistoricalInsurerIds: Array.isArray(allHistoricalInsurerIds) ? allHistoricalInsurerIds : [],
    customPractices,
    practiceCodeMap,
    practiceKeyToId,
  });
});

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const { medicId } = params;
  const formData = await request.formData();
  const payload = parseFormJson<{
    insurerPrices?: unknown;
    hiddenInsurers?: string[];
    practiceCodes?: Record<string, Record<string, string>>;
  }>(formData.get('payload'));

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

  // Extract custom practice keys from payload so they aren't stripped
  const rawPrices = payload.insurerPrices as Record<string, Record<string, unknown>> | undefined;
  const customKeys: string[] = [];
  if (rawPrices) {
    for (const prices of Object.values(rawPrices)) {
      if (prices && typeof prices === 'object') {
        for (const key of Object.keys(prices)) {
          if (key.startsWith('custom_') && !customKeys.includes(key)) {
            customKeys.push(key);
          }
        }
      }
    }
  }

  const insurerPrices = normalizeInsurerPrices(payload.insurerPrices, customKeys.length > 0 ? customKeys : undefined);
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

  // Save practice codes
  const practiceCodes = payload.practiceCodes as Record<string, Record<string, string>> | undefined;
  if (practiceCodes) {
    // Fetch all practices to map practiceKey → practiceId
    const practicesRes = await client.service('practices' as any).find({ query: { $limit: 200 } });
    const practicesList = Array.isArray(practicesRes) ? practicesRes : ((practicesRes as any)?.data ?? []);
    const keyToId = new Map<string, string>();
    for (const p of practicesList) {
      keyToId.set((p as any).systemKey || `custom_${(p as any).id}`, (p as any).id);
    }

    // Fetch existing codes for this medic
    const existingRes = await client.service('practice-codes' as any).find({
      query: { userId: medicId, $limit: 500 },
    });
    const existingCodes = Array.isArray(existingRes) ? existingRes : ((existingRes as any)?.data ?? []);
    const existingMap = new Map<string, any>();
    for (const ec of existingCodes) {
      existingMap.set(`${(ec as any).insurerId}:${(ec as any).practiceId}`, ec);
    }

    for (const [insurerId, practiceEntries] of Object.entries(practiceCodes)) {
      if (insurerId === '_particular') continue;
      for (const [practiceKey, code] of Object.entries(practiceEntries)) {
        const practiceId = keyToId.get(practiceKey);
        if (!practiceId) continue;

        const mapKey = `${insurerId}:${practiceId}`;
        const existing = existingMap.get(mapKey);
        const trimmed = code.trim();

        if (trimmed && existing) {
          if ((existing as any).code !== trimmed) {
            await client.service('practice-codes' as any).patch((existing as any).id, { code: trimmed });
          }
        } else if (trimmed && !existing) {
          await client.service('practice-codes' as any).create({
            practiceId,
            insurerId,
            userId: medicId,
            code: trimmed,
          });
        } else if (!trimmed && existing) {
          await client.service('practice-codes' as any).remove((existing as any).id);
        }
      }
    }
  }

  return json({ ok: true });
};

export default function AccountingSettingsPage() {
  const { t } = useTranslation();
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const feathersClient = useFeathers();
  const params = useParams();
  const medicId = params.medicId;
  const [insurerPrices, setInsurerPrices] = useState<InsurerPrices>(data.insurerPrices);
  const [insurers, setInsurers] = useState<Prepaga[]>(data.insurers as Prepaga[]);
  const [activeInsurerId, setActiveInsurerId] = useState<string | null>(data.insurers[0]?.id ?? null);
  const [pricingMode, setPricingMode] = useState<'normal' | 'emergency'>('normal');
  const [hiddenInsurers, setHiddenInsurers] = useState<string[]>(data.hiddenInsurers || []);
  const [showHiddenInsurers, setShowHiddenInsurers] = useState(false);
  const [showAddInsurer, setShowAddInsurer] = useState(false);

  // Practice codes state: practiceCodesState[insurerId][practiceKey] = code string
  const [practiceCodesState, setPracticeCodesState] = useState<Record<string, Record<string, string>>>(() => {
    const map: Record<string, Record<string, string>> = {};
    const pcMap = data.practiceCodeMap as Record<string, Record<string, { code: string }>> | undefined;
    if (pcMap) {
      for (const [insId, practices] of Object.entries(pcMap)) {
        map[insId] = {};
        for (const [pKey, entry] of Object.entries(practices)) {
          map[insId][pKey] = entry.code;
        }
      }
    }
    return map;
  });
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [backfillRange, setBackfillRange] = useState<DateRangeFilterState>({
    mode: 'in_last',
    lastAmount: 30,
    lastUnit: 'day',
    singleDate: dayjs().format('YYYY-MM-DD'),
    betweenRange: [dayjs().subtract(30, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
  });
  const [uncostedCount, setUncostedCount] = useState<number | null>(null);
  const [uncostedPractices, setUncostedPractices] = useState<
    { practiceId: string; practiceType: 'studies' | 'encounters' }[]
  >([]);
  const [backfillLoading, setBackfillLoading] = useState(false);

  const isSaving = fetcher.state !== 'idle';

  const [activeTierName, setActiveTierName] = useState<string | null>(null);

  // Reset tier selection when insurer changes
  useEffect(() => {
    setActiveTierName(null);
  }, [activeInsurerId]);

  const activeInsurer = useMemo(
    () => insurers.find(insurer => insurer.id === activeInsurerId) ?? null,
    [activeInsurerId, insurers]
  );

  const activeTierOptions = useMemo(() => {
    if (!activeInsurer || !activeInsurer.tiers || activeInsurer.tiers.length === 0) return [];
    return activeInsurer.tiers.map(tier => ({
      value: tier.name,
      label: tier.name,
    }));
  }, [activeInsurer]);

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

  const handlePracticeCodeChange = useCallback(
    (practiceKey: string, code: string) => {
      if (!activeInsurerId) return;
      setPracticeCodesState(prev => ({
        ...prev,
        [activeInsurerId]: {
          ...(prev[activeInsurerId] ?? {}),
          [practiceKey]: code,
        },
      }));
    },
    [activeInsurerId]
  );

  const handleSave = useCallback(() => {
    fetcher.submit(
      { payload: JSON.stringify({ insurerPrices, hiddenInsurers, practiceCodes: practiceCodesState }) },
      { method: 'post' }
    );
  }, [fetcher, insurerPrices, hiddenInsurers, practiceCodesState]);

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
    (practiceKey: string): PricingConfig => {
      const base = toPricingConfig(activePrices[practiceKey]);
      if (!activeTierName || !base.tierPrices?.[activeTierName]) return base;
      const override = base.tierPrices[activeTierName];
      return {
        ...base,
        ...(override.value !== undefined ? { value: override.value } : {}),
        ...(override.multiplier !== undefined ? { multiplier: override.multiplier } : {}),
        ...(override.emergencyValue !== undefined ? { emergencyValue: override.emergencyValue } : {}),
        ...(override.emergencyMultiplier !== undefined ? { emergencyMultiplier: override.emergencyMultiplier } : {}),
        ...(override.extras !== undefined ? { extras: override.extras } : {}),
        ...(override.emergencyExtras !== undefined ? { emergencyExtras: override.emergencyExtras } : {}),
      };
    },
    [activePrices, activeTierName]
  );

  const updatePracticePriceField = useCallback(
    (practiceKey: string, field: keyof TierPriceOverride, fieldValue: unknown) => {
      if (!activeInsurerId) return;
      setInsurerPrices(prev => {
        const current = prev[activeInsurerId] ?? {};
        const practiceConfig = toPricingConfig(current[practiceKey]);

        if (!activeTierName) {
          return {
            ...prev,
            [activeInsurerId]: {
              ...current,
              [practiceKey]: { ...practiceConfig, [field]: fieldValue },
            },
          };
        }

        const existingTierPrices = practiceConfig.tierPrices ?? {};
        const existingOverride = existingTierPrices[activeTierName] ?? {};
        return {
          ...prev,
          [activeInsurerId]: {
            ...current,
            [practiceKey]: {
              ...practiceConfig,
              tierPrices: {
                ...existingTierPrices,
                [activeTierName]: { ...existingOverride, [field]: fieldValue },
              },
            },
          },
        };
      });
    },
    [activeInsurerId, activeTierName]
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

  const handlePracticeFixedValueChange = useCallback(
    (practiceKey: string, value: string | number) => {
      updatePracticePriceField(practiceKey, 'value', toNumericPrice(value));
    },
    [updatePracticePriceField]
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
      updatePracticePriceField(practiceKey, 'multiplier', toNumericPrice(value));
    },
    [updatePracticePriceField]
  );

  const handleEmergencyFixedValueChange = useCallback(
    (practiceKey: string, value: string | number) => {
      updatePracticePriceField(practiceKey, 'emergencyValue', toNumericPrice(value));
    },
    [updatePracticePriceField]
  );

  const handleEmergencyMultiplierChange = useCallback(
    (practiceKey: string, value: string | number) => {
      updatePracticePriceField(practiceKey, 'emergencyMultiplier', toNumericPrice(value));
    },
    [updatePracticePriceField]
  );

  const handleEmergencyExtraCostChange = useCallback(
    (practiceKey: string, sectionName: string, value: string | number) => {
      if (!activeInsurerId) return;
      setInsurerPrices(prev => {
        const current = toPricingConfig(prev[activeInsurerId]?.[practiceKey]);

        if (!activeTierName) {
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
        }

        const existingTierPrices = current.tierPrices ?? {};
        const existingOverride = existingTierPrices[activeTierName] ?? {};
        return {
          ...prev,
          [activeInsurerId]: {
            ...(prev[activeInsurerId] ?? {}),
            [practiceKey]: {
              ...current,
              tierPrices: {
                ...existingTierPrices,
                [activeTierName]: {
                  ...existingOverride,
                  emergencyExtras: {
                    ...(existingOverride.emergencyExtras ?? {}),
                    [sectionName]: toNumericPrice(value),
                  },
                },
              },
            },
          },
        };
      });
    },
    [activeInsurerId, activeTierName]
  );

  const handleExtraCostChange = useCallback(
    (practiceKey: string, sectionName: string, value: string | number) => {
      if (!activeInsurerId) {
        return;
      }
      setInsurerPrices(prev => {
        const current = toPricingConfig(prev[activeInsurerId]?.[practiceKey]);

        if (!activeTierName) {
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
        }

        const existingTierPrices = current.tierPrices ?? {};
        const existingOverride = existingTierPrices[activeTierName] ?? {};
        return {
          ...prev,
          [activeInsurerId]: {
            ...(prev[activeInsurerId] ?? {}),
            [practiceKey]: {
              ...current,
              tierPrices: {
                ...existingTierPrices,
                [activeTierName]: {
                  ...existingOverride,
                  extras: {
                    ...(existingOverride.extras ?? {}),
                    [sectionName]: toNumericPrice(value),
                  },
                },
              },
            },
          },
        };
      });
    },
    [activeInsurerId, activeTierName]
  );

  const copyFromOptions = useMemo(() => {
    return insurers
      .filter(i => i.id !== activeInsurerId && insurerPrices[i.id])
      .map(i => ({
        value: i.id,
        label: i.id === PARTICULAR_INSURER_ID ? t('accounting.settings_particular') : i.shortName,
      }));
  }, [insurers, activeInsurerId, insurerPrices, t]);

  const handleCopyFrom = useCallback(
    (sourceInsurerId: string | null) => {
      if (!sourceInsurerId || !activeInsurerId) return;
      setInsurerPrices(prev => ({
        ...prev,
        [activeInsurerId]: JSON.parse(JSON.stringify(prev[sourceInsurerId] ?? {})),
      }));
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

  const handleShowHiddenInsurersChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setShowHiddenInsurers(event.currentTarget.checked);
  }, []);

  const handleAddInsurer = useCallback(
    (prepaga: {
      id: string;
      shortName: string;
      denomination: string;
      tiers?: { name: string; code: number | null }[];
    }) => {
      if (insurers.some(i => i.id === prepaga.id)) {
        setActiveInsurerId(prepaga.id);
        setShowAddInsurer(false);
        return;
      }
      setInsurers(prev => [
        ...prev,
        {
          id: prepaga.id,
          shortName: prepaga.shortName,
          denomination: prepaga.denomination,
          tiers: prepaga.tiers || [],
        },
      ]);
      setInsurerPrices(prev => {
        if (prev[prepaga.id]) return prev;
        return { ...prev, [prepaga.id]: {} };
      });
      setActiveInsurerId(prepaga.id);
      setShowAddInsurer(false);
    },
    [insurers]
  );

  const handleAddAllHistorical = useCallback(async () => {
    const historicalIds: string[] = data.allHistoricalInsurerIds || [];
    const existingIds = new Set(insurers.map(i => i.id));
    const newIds = historicalIds.filter(id => !existingIds.has(id));
    if (newIds.length === 0) return;

    setLoadingHistorical(true);
    try {
      const response = await feathersClient.service('prepagas').find({
        query: { id: { $in: newIds }, $limit: newIds.length },
      });
      const prepagaList = (Array.isArray(response) ? response : ((response as any).data ?? [])) as Prepaga[];
      setInsurers(prev => [
        ...prev,
        ...prepagaList.map(p => ({
          id: p.id,
          shortName: p.shortName,
          denomination: p.denomination,
          tiers: p.tiers || [],
        })),
      ]);
    } finally {
      setLoadingHistorical(false);
    }
  }, [data.allHistoricalInsurerIds, insurers, feathersClient]);

  const handleFindUncosted = useCallback(async () => {
    if (!medicId) return;

    const resolved = resolveDateRange(backfillRange, {
      minRangeStart: '1900-01-01',
      maxDate: dayjs().format('YYYY-MM-DD'),
      precision: 'day',
    });
    if (!resolved) return;

    setBackfillLoading(true);

    try {
      const result = await (feathersClient.service('accounting') as any).get('uncosted', {
        query: {
          medicId,
          from: dayjs(resolved.from).format('YYYY-MM-DD'),
          to: dayjs(resolved.to).format('YYYY-MM-DD'),
        },
      });
      const practices = Array.isArray(result) ? result : [];
      setUncostedPractices(practices.map((p: any) => ({ practiceId: p.practiceId, practiceType: p.practiceType })));
      setUncostedCount(practices.length);
    } catch (err: any) {
      console.error('Find uncosted failed:', err);
      setUncostedCount(0);
      showNotification({ color: 'red', message: err.message || 'Failed to find uncosted practices' });
    } finally {
      setBackfillLoading(false);
    }
  }, [medicId, backfillRange, feathersClient]);

  const handleBackfillAll = useCallback(async () => {
    if (uncostedPractices.length === 0) return;
    setBackfillLoading(true);
    try {
      const result = await (feathersClient.service('accounting') as any).create({
        intent: 'backfill',
        practiceIds: uncostedPractices.map(p => ({ id: p.practiceId, practiceType: p.practiceType })),
      });
      const prevUncosted = [...uncostedPractices];
      const prevCount = uncostedPractices.length;
      setUncostedCount(0);
      setUncostedPractices([]);
      const msg = t('accounting.settings_backfill_result', {
        backfilled: result.backfilled,
        skipped: result.skipped,
      });
      const hasErrors = (result.errors?.length ?? 0) > 0;
      const ids: string[] = result.createdIds || [];
      showNotification({
        color: hasErrors ? 'orange' : 'teal',
        autoClose: ids.length > 0 ? 10000 : 4000,
        message: (
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="sm">{hasErrors ? `${msg}\n${result.errors.join('; ')}` : msg}</Text>
            {ids.length > 0 && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={() => {
                  (feathersClient.service('accounting') as any)
                    .create({ intent: 'undo-backfill', practiceCostIds: ids })
                    .then(() => {
                      setUncostedPractices(prevUncosted);
                      setUncostedCount(prevCount);
                      showNotification({ color: 'teal', message: t('common.undone') });
                    })
                    .catch((err: any) => {
                      showNotification({ color: 'red', message: err.message || 'Undo failed' });
                    });
                }}
              >
                {t('common.undo')}
              </Button>
            )}
          </Group>
        ),
      });
    } catch (err: any) {
      console.error('Backfill failed:', err);
      showNotification({ color: 'red', message: err.message || 'Backfill failed' });
    } finally {
      setBackfillLoading(false);
    }
  }, [uncostedPractices, feathersClient, t]);

  const tourSteps = getAccountingSettingsSteps(t);
  const {
    run: tourRun,
    stepIndex: tourStepIndex,
    handleCallback: tourHandleCallback,
  } = useSectionTour('accounting-settings', tourSteps);

  return (
    <Layout>
      <Joyride
        steps={tourSteps}
        run={tourRun}
        stepIndex={tourStepIndex}
        callback={tourHandleCallback}
        continuous
        showSkipButton
        disableOverlayClose={false}
        tooltipComponent={TourTooltip}
        styles={{ options: { zIndex: 10000 } }}
      />
      <Portal id="form-actions">
        <Group justify="flex-end" flex={1}>
          {activeInsurerId && copyFromOptions.length > 0 && (
            <div data-tour="acct-settings-copy-from">
              <Select
                placeholder={t('accounting.settings_copy_from')}
                data={copyFromOptions}
                value={null}
                onChange={handleCopyFrom}
                searchable
                clearable
                variant="filled"
                style={{ width: 200 }}
              />
            </div>
          )}
          {hasAnyMultiplier && (
            <Group gap="sm" data-tour="acct-settings-base-value">
              <TextInput
                value={activeInsurerBaseName}
                onChange={handleInsurerBaseNameChange}
                placeholder={t('accounting.settings_base_name_placeholder')}
                style={{ width: '120px' }}
                variant="filled"
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
                variant="filled"
              />
            </Group>
          )}
          <Button data-tour="acct-settings-save" onClick={handleSave} loading={isSaving}>
            {t('common.save')}
          </Button>
        </Group>
      </Portal>

      <Sidebar>
        <Stack
          bg="white"
          pb="sm"
          gap="xs"
          px="sm"
          style={{
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            position: 'sticky',
            top: 0,
            zIndex: 2,
            backgroundColor: 'white',
          }}
        >
          {!showAddInsurer && (
            <Input
              data-tour="acct-settings-search"
              placeholder={t('accounting.settings_search_insurers')}
              variant="unstyled"
              size="lg"
              leftSection={<MagnifyingGlassIcon size={16} />}
              onChange={event => handleSearchChange(event.currentTarget.value)}
              styles={{
                wrapper: {
                  marginLeft: '-0.75rem',
                  borderBottom: '1px solid var(--mantine-color-gray-2)',
                  width: 'calc(100% + (var(--mantine-spacing-sm) * 2))',
                },
                input: {
                  fontSize: '1rem',
                },
              }}
            />
          )}
          {showAddInsurer ? (
            <Flex gap={0} pt="sm">
              <ActionIcon variant="transparent" size="input-xs" onClick={() => setShowAddInsurer(false)}>
                <ArrowLeftIcon size={14} />
              </ActionIcon>
              <PrepagaSelector
                autoFocus={true}
                value={undefined}
                onChange={() => {}}
                onSelectPrepaga={handleAddInsurer}
                onEscape={() => setShowAddInsurer(false)}
                placeholder={t('accounting.settings_search_add_insurer')}
              />
            </Flex>
          ) : (
            <Group gap={0}>
              <Button
                data-tour="acct-settings-add-insurer"
                variant="light"
                size="xs"
                leftSection={<PlusIcon size={14} />}
                onClick={() => setShowAddInsurer(true)}
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                flex={1}
              >
                {t('accounting.settings_add_insurer')}
              </Button>
              {(data.allHistoricalInsurerIds?.length ?? 0) > 0 && (
                <Popover position="bottom-end" withArrow>
                  <Popover.Target>
                    <ActionIcon
                      variant="light"
                      size="input-xs"
                      style={{
                        borderLeft: '1px solid var(--mantine-primary-color-1)',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                      }}
                    >
                      <CaretDownIcon size={14} />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown p={0}>
                    <Button
                      data-tour="acct-settings-add-past"
                      variant="transparent"
                      size="xs"
                      leftSection={<ClockCounterClockwiseIcon size={14} />}
                      onClick={handleAddAllHistorical}
                      loading={loadingHistorical}
                      flex={1}
                    >
                      {t('accounting.settings_add_all_past')}
                    </Button>
                  </Popover.Dropdown>
                </Popover>
              )}
            </Group>
          )}
        </Stack>
        <SidebarList>
          {insurers
            .filter(insurer => showHiddenInsurers || !hiddenInsurers.includes(insurer.id))
            .map(insurer => (
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
        <InsurerFilter>
          <Stack gap="sm">
            <Switch
              label={t('accounting.settings_show_hidden_insurers')}
              checked={showHiddenInsurers}
              onChange={handleShowHiddenInsurersChange}
            />
            <Divider />
            <Text size="xs" fw={600} c="dimmed" data-tour="acct-settings-backfill">
              {t('accounting.settings_backfill')}
            </Text>
            <DateRangePopover
              value={backfillRange}
              onApply={nextState => setBackfillRange(nextState)}
              minRangeStart="1900-01-01"
              maxDate={dayjs().format('YYYY-MM-DD')}
              precision="day"
              variant="filled"
              fullWidth
            />
            <Flex gap="xs">
              <Button flex={1} size="xs" variant="light" onClick={handleFindUncosted} loading={backfillLoading}>
                {t('accounting.settings_find_uncosted')}
              </Button>
              {uncostedCount !== null && uncostedCount > 0 && (
                <Button
                  flex={1}
                  size="xs"
                  variant="filled"
                  color="orange"
                  onClick={handleBackfillAll}
                  loading={backfillLoading}
                >
                  {t('accounting.settings_backfill_all', {
                    count: uncostedCount,
                  })}
                </Button>
              )}
            </Flex>
          </Stack>
        </InsurerFilter>
      </Sidebar>

      <Content>
        {!activeInsurer && <Text c="dimmed">{t('common.no_results')}</Text>}
        {activeInsurer && (
          <Stack gap="0">
            <Group justify="space-between" mb="md">
              <Stack gap="0">
                <Group align="center" gap="md">
                  <Title>
                    {activeInsurer.id === PARTICULAR_INSURER_ID
                      ? t('accounting.settings_particular')
                      : activeInsurer.shortName}
                  </Title>
                  {activeTierOptions.length > 0 && (
                    <Select
                      placeholder={t('accounting.settings_all_plans')}
                      data={activeTierOptions}
                      value={activeTierName}
                      onChange={setActiveTierName}
                      clearable
                      size="sm"
                      style={{ width: '200px' }}
                    />
                  )}
                </Group>
                <InsurerName>
                  {activeInsurer.id === PARTICULAR_INSURER_ID
                    ? t('accounting.settings_particular')
                    : activeInsurer.denomination}
                </InsurerName>
              </Stack>
              <Switch
                data-tour="acct-settings-visibility"
                label={t('accounting.settings_visible')}
                checked={!hiddenInsurers.includes(activeInsurer.id)}
                onChange={handleToggleVisibility}
              />
            </Group>

            <SegmentedControl
              data-tour="acct-settings-pricing-mode"
              value={pricingMode}
              onChange={v => setPricingMode(v as 'normal' | 'emergency')}
              data={[
                { label: t('accounting.settings_normal'), value: 'normal' },
                { label: t('accounting.settings_emergency'), value: 'emergency' },
              ]}
              mb="md"
            />

            {[
              ...ACCOUNTING_PRACTICE_KEYS.filter(key => pricingMode === 'normal' || key !== 'encounter'),
              ...((data.customPractices || []) as { id: string; title: string }[]).map(p => `custom_${p.id}`),
            ].map((practiceKey, index, array) => {
              const config = getPracticeConfig(practiceKey);
              const practiceType = config.type;
              const customPractice = practiceKey.startsWith('custom_')
                ? ((data.customPractices || []) as { id: string; title: string }[]).find(
                    p => `custom_${p.id}` === practiceKey
                  )
                : null;
              const practiceLabel = customPractice
                ? customPractice.title
                : t(practiceI18nKey[practiceKey as keyof typeof practiceI18nKey]);

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
                      <Text c="var(--mantine-primary-color-4)" fw={600}>
                        {practiceLabel}
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
                        {...(index === 0 ? { 'data-tour': 'acct-settings-practice-type' } : {})}
                      />
                    </Group>
                    <Group justify="stretch">
                      <div {...(index === 0 ? { 'data-tour': 'acct-settings-practice-code' } : {})}>
                        <PracticeCodeInput
                          key={`${activeInsurerId}-${practiceKey}`}
                          value={practiceCodesState[activeInsurerId!]?.[practiceKey] ?? ''}
                          onChange={v => handlePracticeCodeChange(practiceKey, v)}
                        />
                      </div>

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
            })}
          </Stack>
        )}
      </Content>
    </Layout>
  );
}
