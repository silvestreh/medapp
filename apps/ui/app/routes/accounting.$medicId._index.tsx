import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useParams } from '@remix-run/react';
import { BarChart, PieChart } from '@mantine/charts';
import { ActionIcon, Button, Drawer, Group, Menu, NativeSelect, Paper, Stack, Text, Title, Table } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { CaretDownIcon, FunnelIcon, GearIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import Joyride from 'react-joyride';

import { authenticatedLoader, getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { DateRangePopover, resolveDateRange, type DateRangeFilterState } from '~/components/date-range-popover';
import { useFeathers } from '~/components/provider';
import { normalizeInsurerPrices, PARTICULAR_INSURER_ID } from '~/utils/accounting';
import { media } from '~/media';
import { styled } from '~/styled-system/jsx';
import { css } from '~/styled-system/css';
import { useSectionTour } from '~/components/guided-tour/use-section-tour';
import { getAccountingSteps } from '~/components/guided-tour/tour-steps/accounting-steps';
import TourTooltip from '~/components/guided-tour/tour-tooltip';
import {
  AccountingRecordRow,
  UncostedPracticeRow,
  AccountingTableHeader,
  AccountingActionBar,
  type AccountingResult,
  type UncostedPractice,
} from '~/components/accounting';
import { Fab } from '~/components/fab';

type Prepaga = {
  id: string;
  shortName: string;
  denomination: string;
};

const ContentWrapper = styled('div', {
  base: {
    padding: '1rem',
    md: {
      padding: '2rem',
    },
  },
});

const MIN_RANGE_START = '1900-01-01';

const STUDY_TYPE_I18N: Record<string, string> = {
  anemia: 'accounting.type_anemia',
  anticoagulation: 'accounting.type_anticoagulation',
  compatibility: 'accounting.type_compatibility',
  hemostasis: 'accounting.type_hemostasis',
  myelogram: 'accounting.type_myelogram',
  thrombophilia: 'accounting.type_thrombophilia',
};

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
  const acctSettings = acctSettingsList[0] as { insurerPrices?: unknown; hiddenInsurers?: string[] } | undefined;
  const insurerPrices = normalizeInsurerPrices(acctSettings?.insurerPrices);
  const hiddenInsurers = Array.isArray(acctSettings?.hiddenInsurers) ? acctSettings.hiddenInsurers : [];
  const insurerIds = Object.keys(insurerPrices);

  const insurersResponse = insurerIds.length
    ? await client.service('prepagas').find({
        query: { id: { $in: insurerIds }, $limit: insurerIds.length },
        paginate: false,
      })
    : [];
  const insurers = (
    Array.isArray(insurersResponse) ? insurersResponse : ((insurersResponse as { data?: unknown[] }).data ?? [])
  ) as Prepaga[];

  return json({ insurers, hiddenInsurers });
});

export default function AccountingDashboardPage() {
  const { t } = useTranslation();
  const feathersClient = useFeathers();
  const { insurers, hiddenInsurers } = useLoaderData<typeof loader>();
  const params = useParams();
  const medicId = params.medicId;
  const [selectedInsurerId, setSelectedInsurerId] = useState<string>('all');
  const [selectedPracticeType, setSelectedPracticeType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'billed' | 'unbilled' | 'uncosted'>('all');
  const isDesktop = useMediaQuery(media.lg);
  const [filtersOpened, { open: openFilters, close: closeFilters }] = useDisclosure(false);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccountingResult | null>(null);
  const [rangeFilter, setRangeFilter] = useState<DateRangeFilterState>({
    mode: 'in_last',
    lastAmount: 30,
    lastUnit: 'day',
    singleDate: dayjs().format('YYYY-MM-DD'),
    betweenRange: [dayjs().subtract(30, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
  });

  const [uncostedPractices, setUncostedPractices] = useState<UncostedPractice[]>([]);
  const [selectedForBackfill, setSelectedForBackfill] = useState<Set<string>>(new Set());
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [selectedForBilling, setSelectedForBilling] = useState<Set<string>>(new Set());
  const [billingLoading, setBillingLoading] = useState(false);
  const lastBillingClickIdx = useRef<number | null>(null);
  const lastBackfillClickIdx = useRef<number | null>(null);
  const lastBilledIdsRef = useRef<string[]>([]);
  const lastBackfilledRef = useRef<{ ids: string[]; practices: UncostedPractice[] }>({ ids: [], practices: [] });
  const tableRef = useRef<HTMLTableElement>(null);
  const shiftHeldRef = useRef(false);

  useEffect(() => {
    const el = tableRef.current;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeldRef.current = true;
        if (el) el.style.userSelect = 'none';
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        shiftHeldRef.current = false;
        if (el) el.style.userSelect = '';
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const resolvedRange = useMemo(
    () =>
      resolveDateRange(rangeFilter, {
        minRangeStart: MIN_RANGE_START,
        maxDate: dayjs().format('YYYY-MM-DD'),
        precision: 'day',
      }),
    [rangeFilter]
  );

  const handleApplyRange = useCallback((nextState: DateRangeFilterState) => {
    setRangeFilter(nextState);
  }, []);

  useEffect(() => {
    if (!resolvedRange || !medicId) return;

    let cancelled = false;
    setLoading(true);

    const query: Record<string, string> = {
      from: dayjs(resolvedRange.from).format('YYYY-MM-DD'),
      to: dayjs(resolvedRange.to).format('YYYY-MM-DD'),
      medicId: medicId,
    };
    if (selectedInsurerId !== 'all') {
      query.insurerId = selectedInsurerId;
    }
    if (selectedPracticeType !== 'all') {
      query.practiceType = selectedPracticeType;
    }
    if (selectedStatus === 'billed' || selectedStatus === 'unbilled') {
      query.status = selectedStatus;
    }

    feathersClient
      .service('accounting')
      .find({ query })
      .then((result: AccountingResult) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [feathersClient, resolvedRange, selectedInsurerId, selectedPracticeType, selectedStatus, medicId]);

  // Fetch uncosted practices for the same date range
  useEffect(() => {
    if (!resolvedRange || !medicId) return;

    let cancelled = false;

    const query: Record<string, string> = {
      from: dayjs(resolvedRange.from).format('YYYY-MM-DD'),
      to: dayjs(resolvedRange.to).format('YYYY-MM-DD'),
      medicId,
    };
    if (selectedInsurerId !== 'all') {
      query.insurerId = selectedInsurerId;
    }

    (feathersClient.service('accounting') as any)
      .get('uncosted', { query })
      .then((result: UncostedPractice[]) => {
        if (!cancelled) {
          setUncostedPractices(Array.isArray(result) ? result : []);
          setSelectedForBackfill(new Set());
        }
      })
      .catch((err: any) => {
        console.error('Failed to fetch uncosted:', err);
        if (!cancelled) {
          setUncostedPractices([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [feathersClient, resolvedRange, medicId, selectedInsurerId]);

  const allRecords = data?.records ?? [];
  const totalRevenue = data?.totalRevenue ?? 0;
  const revenueByInsurer = data?.revenueByInsurer ?? [];

  const filteredRecords = useMemo(() => {
    if (selectedStatus === 'uncosted') return [];
    return allRecords;
  }, [allRecords, selectedStatus]);

  const filteredUncostedPractices = useMemo(() => {
    if (selectedStatus === 'billed' || selectedStatus === 'unbilled') return [];
    let result = uncostedPractices;
    if (selectedPracticeType !== 'all') {
      if (selectedPracticeType === 'encounter') {
        result = result.filter(p => p.practiceType === 'encounters');
      } else {
        result = result.filter(p => p.practiceType === 'studies' && p.studies?.includes(selectedPracticeType));
      }
    }
    return result;
  }, [uncostedPractices, selectedPracticeType, selectedStatus]);

  const availablePracticeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const r of allRecords) {
      types.add(r.kind);
    }
    for (const p of uncostedPractices) {
      if (p.practiceType === 'encounters') {
        types.add('encounter');
      }
      if (p.practiceType === 'studies' && p.studies) {
        for (const s of p.studies) {
          types.add(s);
        }
      }
    }
    return Array.from(types).sort();
  }, [allRecords, uncostedPractices]);

  const records = filteredRecords;

  const translateType = useCallback(
    (kind: string) => {
      if (kind === 'encounter') {
        return t('accounting.kind_encounter');
      }
      const key = STUDY_TYPE_I18N[kind];
      return key ? t(key, { defaultValue: kind }) : kind;
    },
    [t]
  );

  const selectedInsurerLabel = useMemo(() => {
    if (selectedInsurerId === 'all') return t('accounting.filter_insurer');
    const found = insurers.find((i: Prepaga) => i.id === selectedInsurerId);
    return found ? found.shortName : t('accounting.filter_insurer');
  }, [selectedInsurerId, insurers, t]);

  const handleSelectInsurer = useCallback((id: string) => {
    setSelectedInsurerId(id);
  }, []);

  const handleSelectPracticeType = useCallback((type: string) => {
    setSelectedPracticeType(type);
    setSelectedForBackfill(new Set());
    setSelectedForBilling(new Set());
  }, []);

  const handleSelectStatus = useCallback((status: 'all' | 'billed' | 'unbilled' | 'uncosted') => {
    setSelectedStatus(status);
    setSelectedForBackfill(new Set());
    setSelectedForBilling(new Set());
  }, []);

  const selectedPracticeTypeLabel = useMemo(() => {
    if (selectedPracticeType === 'all') return t('accounting.filter_practice_type');
    return translateType(selectedPracticeType);
  }, [selectedPracticeType, t, translateType]);

  const selectedStatusLabel = useMemo(() => {
    if (selectedStatus === 'all') return t('accounting.filter_status');
    return t(`accounting.${selectedStatus}`);
  }, [selectedStatus, t]);

  const visibleInsurers = useMemo(() => {
    return insurers.filter((insurer: Prepaga) => !hiddenInsurers.includes(insurer.id));
  }, [insurers, hiddenInsurers]);

  const insurerSelectData = useMemo(
    () => [
      { value: 'all', label: t('common.all') },
      ...visibleInsurers.map((i: Prepaga) => ({ value: i.id, label: i.shortName })),
    ],
    [visibleInsurers, t]
  );

  const practiceTypeSelectData = useMemo(
    () => [
      { value: 'all', label: t('common.all') },
      ...availablePracticeTypes.map(type => ({ value: type, label: translateType(type) })),
    ],
    [availablePracticeTypes, translateType, t]
  );

  const statusSelectData = useMemo(
    () => [
      { value: 'all', label: t('common.all') },
      { value: 'billed', label: t('accounting.billed') },
      { value: 'unbilled', label: t('accounting.unbilled') },
      { value: 'uncosted', label: t('accounting.uncosted') },
    ],
    [t]
  );

  const insurerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ins of insurers) {
      map.set(ins.id, ins.shortName);
    }
    map.set(PARTICULAR_INSURER_ID, t('accounting.settings_particular'));
    return map;
  }, [insurers, t]);

  const hasUncosted = filteredUncostedPractices.length > 0;

  const handleToggleBackfillSelect = useCallback(
    (practiceId: string, idx: number, _e: React.ChangeEvent<HTMLInputElement>) => {
      const shiftKey = shiftHeldRef.current;
      if (shiftKey) window.getSelection()?.removeAllRanges();

      setSelectedForBackfill(prev => {
        const next = new Set(prev);
        const willSelect = !next.has(practiceId);

        if (shiftKey && lastBackfillClickIdx.current != null) {
          const from = Math.min(lastBackfillClickIdx.current, idx);
          const to = Math.max(lastBackfillClickIdx.current, idx);
          for (let i = from; i <= to; i++) {
            const id = filteredUncostedPractices[i]?.practiceId;
            if (!id) continue;
            if (willSelect) {
              next.add(id);
            } else {
              next.delete(id);
            }
          }
        } else {
          if (willSelect) {
            next.add(practiceId);
          } else {
            next.delete(practiceId);
          }
        }

        lastBackfillClickIdx.current = idx;
        return next;
      });
    },
    [filteredUncostedPractices]
  );

  const handleToggleSelectAll = useCallback(() => {
    setSelectedForBackfill(prev => {
      if (prev.size === filteredUncostedPractices.length) {
        return new Set();
      }
      return new Set(filteredUncostedPractices.map(p => p.practiceId));
    });
  }, [filteredUncostedPractices]);

  const unbilledRecords = useMemo(() => records.filter(r => !r.billedAt), [records]);

  const handleToggleBillingSelect = useCallback(
    (practiceCostId: string, idx: number, _e: React.ChangeEvent<HTMLInputElement>) => {
      const shiftKey = shiftHeldRef.current;
      if (shiftKey) window.getSelection()?.removeAllRanges();

      setSelectedForBilling(prev => {
        const next = new Set(prev);
        const willSelect = !next.has(practiceCostId);

        if (shiftKey && lastBillingClickIdx.current != null) {
          const from = Math.min(lastBillingClickIdx.current, idx);
          const to = Math.max(lastBillingClickIdx.current, idx);
          for (let i = from; i <= to; i++) {
            const id = unbilledRecords[i]?.practiceCostId;
            if (!id) continue;
            if (willSelect) {
              next.add(id);
            } else {
              next.delete(id);
            }
          }
        } else {
          if (willSelect) {
            next.add(practiceCostId);
          } else {
            next.delete(practiceCostId);
          }
        }

        lastBillingClickIdx.current = idx;
        return next;
      });
    },
    [unbilledRecords]
  );

  const handleToggleBillingSelectAll = useCallback(() => {
    setSelectedForBilling(prev => {
      if (prev.size === unbilledRecords.length) {
        return new Set();
      }
      return new Set(unbilledRecords.map(r => r.practiceCostId));
    });
  }, [unbilledRecords]);

  const handleHeaderCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.nativeEvent instanceof MouseEvent && e.nativeEvent.altKey && hasUncosted) {
        handleToggleSelectAll();
      } else {
        handleToggleBillingSelectAll();
      }
    },
    [hasUncosted, handleToggleSelectAll, handleToggleBillingSelectAll]
  );

  const refetchAccounting = useCallback(() => {
    if (!resolvedRange || !medicId) return;
    const query: Record<string, string> = {
      from: dayjs(resolvedRange.from).format('YYYY-MM-DD'),
      to: dayjs(resolvedRange.to).format('YYYY-MM-DD'),
      medicId,
    };
    if (selectedInsurerId !== 'all') {
      query.insurerId = selectedInsurerId;
    }
    feathersClient
      .service('accounting')
      .find({ query })
      .then((result: AccountingResult) => setData(result))
      .catch(() => {});
  }, [resolvedRange, medicId, selectedInsurerId, feathersClient]);

  const handleUndoBackfill = useCallback(() => {
    const { ids, practices } = lastBackfilledRef.current;
    if (ids.length === 0) return;
    (feathersClient.service('accounting') as any)
      .create({ intent: 'undo-backfill', practiceCostIds: ids })
      .then(() => {
        setUncostedPractices(prev => [...prev, ...practices]);
        refetchAccounting();
        showNotification({ color: 'teal', message: t('common.undone') });
      })
      .catch((err: any) => {
        showNotification({ color: 'red', message: err.message || 'Undo failed' });
      });
  }, [feathersClient, refetchAccounting, t]);

  const handleBackfillSelected = useCallback(async () => {
    if (selectedForBackfill.size === 0) return;
    setBackfillLoading(true);
    try {
      const backfilledPractices = uncostedPractices.filter(p => selectedForBackfill.has(p.practiceId));
      const practiceIds = backfilledPractices.map(p => ({ id: p.practiceId, practiceType: p.practiceType }));

      const result = await (feathersClient.service('accounting') as any).create({
        intent: 'backfill',
        practiceIds,
      });

      // Remove backfilled from uncosted list
      setUncostedPractices(prev => prev.filter(p => !selectedForBackfill.has(p.practiceId)));
      setSelectedForBackfill(new Set());
      refetchAccounting();

      const ids: string[] = result.createdIds || [];
      lastBackfilledRef.current = { ids, practices: backfilledPractices };

      const msg = t('accounting.settings_backfill_result', {
        backfilled: result.backfilled,
        skipped: result.skipped,
      });
      showNotification({
        color: 'teal',
        autoClose: ids.length > 0 ? 10000 : 4000,
        message: (
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="sm">{msg}</Text>
            {ids.length > 0 && (
              <Button size="compact-xs" variant="subtle" color="gray" onClick={handleUndoBackfill}>
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
  }, [selectedForBackfill, uncostedPractices, feathersClient, refetchAccounting, t, handleUndoBackfill]);

  const handleUndoBilling = useCallback(() => {
    const ids = lastBilledIdsRef.current;
    if (ids.length === 0) return;
    feathersClient
      .service('accounting')
      .create({ intent: 'unmark-billed', practiceCostIds: ids })
      .then(() => refetchAccounting());
  }, [feathersClient, refetchAccounting]);

  const handleMarkAsBilled = useCallback(async () => {
    if (selectedForBilling.size === 0) return;
    setBillingLoading(true);

    try {
      const practiceCostIds = [...selectedForBilling];
      lastBilledIdsRef.current = practiceCostIds;

      await feathersClient.service('accounting').create({
        intent: 'mark-billed',
        practiceCostIds,
      });

      setSelectedForBilling(new Set());
      refetchAccounting();

      showNotification({
        color: 'green',
        autoClose: 8000,
        message: (
          <Group gap="xs">
            <Text size="sm">
              {t('accounting.marked_as_billed', {
                count: practiceCostIds.length,
              })}
            </Text>
            <Button size="xs" variant="subtle" color="gray" onClick={handleUndoBilling}>
              {t('common.undo')}
            </Button>
          </Group>
        ),
      });
    } catch (err: any) {
      console.error('Mark as billed failed:', err);
      showNotification({ color: 'red', message: err.message || 'Failed to mark as billed' });
    } finally {
      setBillingLoading(false);
    }
  }, [selectedForBilling, feathersClient, refetchAccounting, t, handleUndoBilling]);

  const tourSteps = getAccountingSteps(t);
  const {
    run: tourRun,
    stepIndex: tourStepIndex,
    handleCallback: tourHandleCallback,
  } = useSectionTour('accounting', tourSteps);

  return (
    <ContentWrapper>
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
        {isDesktop && (
          <Group justify="space-between" align="center" w="100%">
            <Group gap="sm">
              <Menu shadow="md" width={260}>
                <Menu.Target>
                  <Button
                    data-tour="accounting-insurer-filter"
                    variant="filled"
                    color="gray.1"
                    c="gray.7"
                    fw={500}
                    rightSection={<CaretDownIcon size={14} />}
                  >
                    {selectedInsurerLabel}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('navigation.insurers')}</Menu.Label>
                  <Menu.Item onClick={() => handleSelectInsurer('all')} fw={selectedInsurerId === 'all' ? 700 : 400}>
                    {t('common.all')}
                  </Menu.Item>
                  <Menu.Divider />
                  {visibleInsurers.map((insurer: Prepaga) => (
                    <Menu.Item
                      key={insurer.id}
                      onClick={() => handleSelectInsurer(insurer.id)}
                      fw={selectedInsurerId === insurer.id ? 700 : 400}
                    >
                      {insurer.shortName}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
              <Menu shadow="md" width={260}>
                <Menu.Target>
                  <Button
                    variant="filled"
                    color="gray.1"
                    c="gray.7"
                    fw={500}
                    rightSection={<CaretDownIcon size={14} />}
                  >
                    {selectedPracticeTypeLabel}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('accounting.practice_type')}</Menu.Label>
                  <Menu.Item
                    onClick={() => handleSelectPracticeType('all')}
                    fw={selectedPracticeType === 'all' ? 700 : 400}
                  >
                    {t('common.all')}
                  </Menu.Item>
                  <Menu.Divider />
                  {availablePracticeTypes.map(type => (
                    <Menu.Item
                      key={type}
                      onClick={() => handleSelectPracticeType(type)}
                      fw={selectedPracticeType === type ? 700 : 400}
                    >
                      {translateType(type)}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="filled"
                    color="gray.1"
                    c="gray.7"
                    fw={500}
                    rightSection={<CaretDownIcon size={14} />}
                  >
                    {selectedStatusLabel}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{t('accounting.filter_status')}</Menu.Label>
                  <Menu.Item onClick={() => handleSelectStatus('all')} fw={selectedStatus === 'all' ? 700 : 400}>
                    {t('common.all')}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item onClick={() => handleSelectStatus('billed')} fw={selectedStatus === 'billed' ? 700 : 400}>
                    {t('accounting.billed')}
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => handleSelectStatus('unbilled')}
                    fw={selectedStatus === 'unbilled' ? 700 : 400}
                  >
                    {t('accounting.unbilled')}
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => handleSelectStatus('uncosted')}
                    fw={selectedStatus === 'uncosted' ? 700 : 400}
                  >
                    {t('accounting.uncosted')}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <div data-tour="accounting-date-range">
                <DateRangePopover
                  value={rangeFilter}
                  onApply={handleApplyRange}
                  minRangeStart={MIN_RANGE_START}
                  maxDate={dayjs().format('YYYY-MM-DD')}
                  precision="day"
                  variant="filled"
                />
              </div>
              <Button component={Link} to="settings" variant="filled" leftSection={<GearIcon />}>
                {t('common.settings')}
              </Button>
            </Group>
          </Group>
        )}
        {!isDesktop && (
          <ActionIcon component={Link} to="settings" variant="filled" size="lg">
            <GearIcon size={18} />
          </ActionIcon>
        )}
      </Portal>

      {!isDesktop && (
        <>
          <Fab icon={<FunnelIcon size={22} />} onClick={openFilters} />
          <Drawer
            opened={filtersOpened}
            onClose={closeFilters}
            position="bottom"
            title={t('common.filters')}
            styles={{ content: { borderRadius: '1rem 1rem 0 0' } }}
          >
            <Stack gap="sm" pb="md">
              <NativeSelect
                label={t('accounting.filter_insurer')}
                data={insurerSelectData}
                value={selectedInsurerId}
                onChange={e => handleSelectInsurer(e.currentTarget.value)}
              />
              <NativeSelect
                label={t('accounting.filter_practice_type')}
                data={practiceTypeSelectData}
                value={selectedPracticeType}
                onChange={e => handleSelectPracticeType(e.currentTarget.value)}
              />
              <NativeSelect
                label={t('accounting.filter_status')}
                data={statusSelectData}
                value={selectedStatus}
                onChange={e => handleSelectStatus(e.currentTarget.value as 'all' | 'billed' | 'unbilled' | 'uncosted')}
              />
              <Stack gap={4}>
                <Text fw={500} size="sm">
                  {t('common.date_range')}
                </Text>
                <DateRangePopover
                  value={rangeFilter}
                  onApply={handleApplyRange}
                  minRangeStart={MIN_RANGE_START}
                  maxDate={dayjs().format('YYYY-MM-DD')}
                  precision="day"
                  variant="filled"
                  fullWidth
                />
              </Stack>
            </Stack>
          </Drawer>
        </>
      )}

      <Stack gap="md">
        <Paper withBorder p="md" data-tour="accounting-revenue">
          <Text c="dimmed">{t('accounting.total_revenue')}</Text>
          <Title order={2}>${totalRevenue.toFixed(2)}</Title>
          {loading && (
            <Text c="dimmed" size="sm">
              {t('common.loading')}
            </Text>
          )}
        </Paper>

        {revenueByInsurer.length > 0 && (
          <Paper withBorder p="md" data-tour="accounting-chart">
            <Text fw={600} mb="sm">
              {t('accounting.revenue_by_insurer')}
            </Text>
            {isDesktop && (
              <BarChart
                h={260}
                data={revenueByInsurer}
                dataKey="insurer"
                series={[{ name: 'revenue', color: 'blue.6' }]}
              />
            )}
            {!isDesktop &&
              (() => {
                const colors = [
                  'teal.6',
                  'blue.6',
                  'violet.6',
                  'orange.6',
                  'pink.6',
                  'cyan.6',
                  'yellow.6',
                  'grape.6',
                  'lime.6',
                  'indigo.6',
                ];
                const pieData = revenueByInsurer.map((item, i) => ({
                  name: item.insurer,
                  value: item.revenue,
                  color: colors[i % colors.length],
                }));
                return (
                  <Stack gap="sm">
                    <PieChart
                      h={260}
                      size={200}
                      data={pieData}
                      withTooltip
                      tooltipDataSource="segment"
                      labelsType="percent"
                      withLabels
                      withLabelsLine
                      mx="auto"
                    />
                    <Group gap="sm" justify="center" wrap="wrap">
                      {pieData.map(item => (
                        <Group key={item.name} gap={6} wrap="nowrap">
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: `var(--mantine-color-${item.color.replace('.', '-')})`,
                              flexShrink: 0,
                            }}
                          />
                          <Text size="xs" c="dimmed">
                            {item.name}
                          </Text>
                        </Group>
                      ))}
                    </Group>
                  </Stack>
                );
              })()}
          </Paper>
        )}

        {isClient && loading && (
          <Text c="dimmed" ta="center" py="xl">
            {t('common.loading')}
          </Text>
        )}

        <div className={css({ overflowX: 'auto', lg: { overflow: 'visible' } })}>
          <Table
            ref={tableRef}
            data-tour="accounting-table"
            bg="white"
            className={css({
              minWidth: '700px',
              '& .accounting-thead': {
                lg: {
                  position: 'sticky',
                  top: '5rem',
                  zIndex: 1,
                },
              },
              lg: {
                marginTop: '1rem',
                marginLeft: '-2rem',
                width: 'calc(100% + 4rem)',
              },
            })}
          >
            <AccountingTableHeader
              unbilledCount={unbilledRecords.length}
              hasUncosted={hasUncosted}
              selectedForBillingSize={selectedForBilling.size}
              selectedForBackfillSize={selectedForBackfill.size}
              onHeaderCheckboxChange={handleHeaderCheckboxChange}
              onSelectAllBilling={handleToggleBillingSelectAll}
              onSelectAllBackfill={handleToggleSelectAll}
              t={t}
            />
            <Table.Tbody>
              {records.map((record, index) => (
                <AccountingRecordRow
                  key={`${record.id}-${record.kind}-${index}`}
                  record={record}
                  unbilledIdx={record.billedAt ? -1 : unbilledRecords.indexOf(record)}
                  selectedForBilling={selectedForBilling}
                  onToggleBilling={handleToggleBillingSelect}
                  translateType={translateType}
                  t={t}
                />
              ))}
              {filteredUncostedPractices.map((practice, idx) => (
                <UncostedPracticeRow
                  key={`uncosted-${practice.practiceId}`}
                  practice={practice}
                  idx={idx}
                  selectedForBackfill={selectedForBackfill}
                  onToggleBackfill={handleToggleBackfillSelect}
                  translateType={translateType}
                  insurerNameById={insurerNameById}
                  t={t}
                  isFirst={idx === 0}
                />
              ))}
            </Table.Tbody>
          </Table>
        </div>

        {(selectedForBilling.size > 0 || (hasUncosted && selectedForBackfill.size > 0)) && (
          <AccountingActionBar
            selectedForBillingSize={selectedForBilling.size}
            selectedForBackfillSize={selectedForBackfill.size}
            hasUncosted={hasUncosted}
            onMarkAsBilled={handleMarkAsBilled}
            billingLoading={billingLoading}
            onBackfillSelected={handleBackfillSelected}
            backfillLoading={backfillLoading}
            t={t}
          />
        )}
      </Stack>
    </ContentWrapper>
  );
}
