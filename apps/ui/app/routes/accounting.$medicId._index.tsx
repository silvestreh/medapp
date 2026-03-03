import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { Link, useLoaderData, useParams } from '@remix-run/react';
import { BarChart } from '@mantine/charts';
import { Badge, Button, Checkbox, Group, Menu, Paper, Stack, Text, Title, Table } from '@mantine/core';
import { ChevronDown } from 'lucide-react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { authenticatedLoader, getAuthenticatedClient } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { DateRangePopover, resolveDateRange, type DateRangeFilterState } from '~/components/date-range-popover';
import { useFeathers } from '~/components/provider';
import { normalizeInsurerPrices, PARTICULAR_INSURER_ID } from '~/utils/accounting';
import { styled } from '~/styled-system/jsx';
import { css } from '~/styled-system/css';

type Prepaga = {
  id: string;
  shortName: string;
  denomination: string;
};

type AccountingRecord = {
  id: string;
  date: string;
  kind: string;
  protocol: number | null;
  insurerId: string | null;
  insurerName: string;
  patientName: string;
  cost: number;
};

type AccountingResult = {
  records: AccountingRecord[];
  totalRevenue: number;
  revenueByDay: { date: string; revenue: number }[];
  revenueByInsurer: { insurer: string; revenue: number }[];
};

type UncostedPractice = {
  practiceId: string;
  practiceType: 'studies' | 'encounters';
  date: string;
  patientId: string;
  insurerId: string | null;
  effectiveInsurerId: string;
  emergency: boolean;
  studies?: string[];
  patientName: string;
};

const ContentWrapper = styled('div', {
  base: {
    padding: '1rem',
    md: {
      padding: '2rem',
    },
  },
});

const CellText = styled('span', {
  base: {
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    display: 'block',
    padding: 'var(--mantine-spacing-xs)',
    fontSize: 'var(--mantine-font-size-sm)',
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
  }, [feathersClient, resolvedRange, selectedInsurerId, medicId]);

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

    return () => { cancelled = true; };
  }, [feathersClient, resolvedRange, medicId, selectedInsurerId]);

  const records = data?.records ?? [];
  const totalRevenue = data?.totalRevenue ?? 0;
  const revenueByInsurer = data?.revenueByInsurer ?? [];

  const translateType = useCallback(
    (kind: string) => {
      if (kind === 'encounter') {
        return t('accounting.kind_encounter', { defaultValue: 'Encounter' });
      }
      const key = STUDY_TYPE_I18N[kind];
      return key ? t(key, { defaultValue: kind }) : kind;
    },
    [t]
  );

  const selectedInsurerLabel = useMemo(() => {
    if (selectedInsurerId === 'all') return t('common.all', { defaultValue: 'Everything' });
    const found = insurers.find((i: Prepaga) => i.id === selectedInsurerId);
    return found ? found.shortName : t('common.all', { defaultValue: 'Everything' });
  }, [selectedInsurerId, insurers, t]);

  const handleSelectInsurer = useCallback((id: string) => {
    setSelectedInsurerId(id);
  }, []);

  const visibleInsurers = useMemo(() => {
    return insurers.filter((insurer: Prepaga) => !hiddenInsurers.includes(insurer.id));
  }, [insurers, hiddenInsurers]);

  const insurerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ins of insurers) {
      map.set(ins.id, ins.shortName);
    }
    map.set(PARTICULAR_INSURER_ID, t('accounting.settings_particular', { defaultValue: 'Particular' }));
    return map;
  }, [insurers, t]);

  const hasUncosted = uncostedPractices.length > 0;

  const handleToggleBackfillSelect = useCallback((practiceId: string) => {
    setSelectedForBackfill(prev => {
      const next = new Set(prev);
      if (next.has(practiceId)) {
        next.delete(practiceId);
      } else {
        next.add(practiceId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedForBackfill(prev => {
      if (prev.size === uncostedPractices.length) {
        return new Set();
      }
      return new Set(uncostedPractices.map(p => p.practiceId));
    });
  }, [uncostedPractices]);

  const handleBackfillSelected = useCallback(async () => {
    if (selectedForBackfill.size === 0) return;
    setBackfillLoading(true);
    try {
      const practiceIds = uncostedPractices
        .filter(p => selectedForBackfill.has(p.practiceId))
        .map(p => ({ id: p.practiceId, practiceType: p.practiceType }));

      await (feathersClient.service('accounting') as any).create({
        intent: 'backfill',
        practiceIds,
      });

      // Remove backfilled from uncosted list
      setUncostedPractices(prev => prev.filter(p => !selectedForBackfill.has(p.practiceId)));
      setSelectedForBackfill(new Set());

      // Refetch accounting data
      if (resolvedRange && medicId) {
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
      }
    } catch (err: any) {
      console.error('Backfill failed:', err);
      alert(err.message || 'Backfill failed');
    } finally {
      setBackfillLoading(false);
    }
  }, [selectedForBackfill, uncostedPractices, feathersClient, resolvedRange, medicId, selectedInsurerId]);

  return (
    <ContentWrapper>
      <Portal id="form-actions">
        <Group justify="space-between" align="center" w="100%">
          <Group gap="sm">
            <Menu shadow="md" width={260}>
              <Menu.Target>
                <Button variant="filled" color="gray.1" c="gray.7" fw={500} rightSection={<ChevronDown size={14} />}>
                  {selectedInsurerLabel}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('navigation.insurers', { defaultValue: 'Insurers' })}</Menu.Label>
                <Menu.Item onClick={() => handleSelectInsurer('all')} fw={selectedInsurerId === 'all' ? 700 : 400}>
                  {t('common.all', { defaultValue: 'Everything' })}
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
            <DateRangePopover
              value={rangeFilter}
              onApply={handleApplyRange}
              minRangeStart={MIN_RANGE_START}
              maxDate={dayjs().format('YYYY-MM-DD')}
              precision="day"
              variant="filled"
            />
            <Button component={Link} to="settings" variant="filled" color="gray.1" c="gray.7">
              {t('common.settings')}
            </Button>
          </Group>
        </Group>
      </Portal>

      <Stack gap="md">
        <Paper withBorder p="md">
          <Text c="dimmed">{t('accounting.total_revenue', { defaultValue: 'Total revenue' })}</Text>
          <Title order={2}>${totalRevenue.toFixed(2)}</Title>
          {loading && (
            <Text c="dimmed" size="sm">
              {t('common.loading', { defaultValue: 'Loading...' })}
            </Text>
          )}
        </Paper>

        <Paper withBorder p="md">
          <Text fw={600} mb="sm">
            {t('accounting.revenue_by_insurer', { defaultValue: 'Revenue by insurer' })}
          </Text>
          <BarChart h={260} data={revenueByInsurer} dataKey="insurer" series={[{ name: 'revenue', color: 'blue.6' }]} />
        </Paper>

        {isClient && loading && (
          <Text c="dimmed" ta="center" py="xl">
            {t('common.loading', { defaultValue: 'Loading...' })}
          </Text>
        )}

        {hasUncosted && selectedForBackfill.size > 0 && (
          <Paper withBorder p="sm" style={{ position: 'sticky', top: 'calc(5rem + 2.5rem)', zIndex: 2 }}>
            <Group justify="space-between">
              <Text size="sm">
                {t('accounting.backfill_selected_count', {
                  defaultValue: '{{count}} selected for backfill',
                  count: selectedForBackfill.size,
                })}
              </Text>
              <Button
                size="sm"
                color="orange"
                onClick={handleBackfillSelected}
                loading={backfillLoading}
              >
                {t('accounting.backfill_selected', { defaultValue: 'Backfill selected' })}
              </Button>
            </Group>
          </Paper>
        )}

        <Table
          layout="fixed"
          bg="white"
          className={css({
            lg: {
              marginTop: '1rem',
              marginLeft: '-2rem',
              width: 'calc(100% + 4rem)',
            },
          })}
        >
          <Table.Thead style={{ position: 'sticky', top: '5rem', zIndex: 1 }}>
            <Table.Tr bg="blue.0">
              {hasUncosted && (
                <Table.Th
                  style={{ border: '1px solid var(--mantine-color-blue-1)', borderLeft: 'none', width: 40 }}
                  fw={500}
                  py="0.5em"
                >
                  <Checkbox
                    size="xs"
                    checked={selectedForBackfill.size === uncostedPractices.length}
                    indeterminate={selectedForBackfill.size > 0 && selectedForBackfill.size < uncostedPractices.length}
                    onChange={handleToggleSelectAll}
                  />
                </Table.Th>
              )}
              {[
                t('accounting.col_date', { defaultValue: 'Date' }),
                t('accounting.col_type', { defaultValue: 'Type' }),
                // t('accounting.col_protocol', { defaultValue: 'Protocol' }),
                t('accounting.col_insurer', { defaultValue: 'Insurer' }),
                t('accounting.col_patient', { defaultValue: 'Patient' }),
                t('accounting.col_cost', { defaultValue: 'Cost' }),
              ].map((label, idx) => (
                <Table.Th
                  key={label}
                  style={{
                    border: '1px solid var(--mantine-color-blue-1)',
                    ...(!hasUncosted && idx === 0 && { borderLeft: 'none' }),
                    ...(idx === 4 && { borderRight: 'none' }),
                  }}
                  fw={500}
                  fz="md"
                  py="0.5em"
                >
                  {label}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((record, index) => (
              <Table.Tr
                key={`${record.id}-${record.kind}-${index}`}
                styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
              >
                {hasUncosted && <Table.Td />}
                <Table.Td>
                  <CellText>{dayjs(record.date).format('YYYY-MM-DD')}</CellText>
                </Table.Td>
                <Table.Td>
                  <CellText>{translateType(record.kind)}</CellText>
                </Table.Td>
                <Table.Td>
                  <CellText>{record.insurerName}</CellText>
                </Table.Td>
                <Table.Td>
                  <CellText>{record.patientName}</CellText>
                </Table.Td>
                <Table.Td>
                  <CellText>${record.cost.toFixed(2)}</CellText>
                </Table.Td>
              </Table.Tr>
            ))}
            {uncostedPractices.map(practice => (
              <Table.Tr
                key={`uncosted-${practice.practiceId}`}
                style={{ opacity: 0.6 }}
                styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
              >
                <Table.Td>
                  <Checkbox
                    size="xs"
                    checked={selectedForBackfill.has(practice.practiceId)}
                    onChange={() => handleToggleBackfillSelect(practice.practiceId)}
                  />
                </Table.Td>
                <Table.Td>
                  <CellText>{dayjs(practice.date).format('YYYY-MM-DD')}</CellText>
                </Table.Td>
                <Table.Td>
                  <CellText>
                    {practice.practiceType === 'studies'
                      ? (practice.studies || []).map(s => translateType(s)).join(', ')
                      : translateType('encounter')}
                    {' '}
                    <Badge size="xs" color="orange" variant="light">
                      {t('accounting.untracked', { defaultValue: 'untracked' })}
                    </Badge>
                  </CellText>
                </Table.Td>
                <Table.Td>
                  <CellText>{insurerNameById.get(practice.effectiveInsurerId) || '-'}</CellText>
                </Table.Td>
                <Table.Td>
                  <CellText>{practice.patientName}</CellText>
                </Table.Td>
                <Table.Td>
                  <CellText style={{ color: 'var(--mantine-color-dimmed)' }}>$0.00</CellText>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </ContentWrapper>
  );
}
