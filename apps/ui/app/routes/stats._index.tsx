import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Group, Text, Loader, Alert, Paper, SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { AreaChart, BarChart, DonutChart } from '@mantine/charts';
import { Info } from 'lucide-react';
import dayjs from 'dayjs';

import { authenticatedLoader } from '~/utils/auth.server';
import { useFind } from '~/components/provider';
import Portal from '~/components/portal';
import { ToolbarTitle } from '~/components/toolbar-title';

export const loader = authenticatedLoader();

const STUDY_TYPE_COLORS: Record<string, string> = {
  anemia: 'red.6',
  anticoagulation: 'orange.6',
  compatibility: 'yellow.6',
  hemostasis: 'teal.6',
  myelogram: 'indigo.6',
  thrombophilia: 'grape.6',
};

const AGE_BUCKETS = ['0-17', '18-34', '35-49', '50-64', '65+'] as const;

const LARGE_RANGE_DAYS = 90;

interface StudyTypeCount {
  studyType: string;
  count: number;
}

interface AgeGroupEntry {
  studyType: string;
  bucket: string;
  count: number;
}

interface GenderGroupEntry {
  studyType: string;
  gender: 'male' | 'female' | 'other';
  count: number;
}

interface StudiesOverTimeEntry {
  period: string;
  count: number;
}

interface NoOrderRate {
  total: number;
  noOrder: number;
  rate: number;
}

interface CompletionRate {
  total: number;
  withResults: number;
  rate: number;
}

interface NationalityDistributionEntry {
  nationality: string;
  count: number;
}

interface StatsResponse {
  studyTypeCounts: StudyTypeCount[];
  ageGroups: AgeGroupEntry[];
  genderGroups: GenderGroupEntry[];
  studiesOverTime: StudiesOverTimeEntry[];
  noOrderRate: NoOrderRate;
  avgStudiesPerPatient: number;
  completionRate: CompletionRate;
  nationalityDistribution: NationalityDistributionEntry[];
}

export default function StatsIndex() {
  const { t } = useTranslation();
  const countries = useMemo(() => t('countries', { returnObjects: true }) as Record<string, string>, [t]);
  const getLabel = useCallback(
    (type: string) => {
      const key = `stats.type_${type}`;
      return t(key, { defaultValue: type });
    },
    [t]
  );

  const [dateRange, setDateRange] = useState<[string | null, string | null]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD'),
  ]);

  const [from, to] = dateRange;

  const rangeIsValid = from && to && dayjs(to).isAfter(dayjs(from));
  const rangeDays = from && to ? dayjs(to).diff(dayjs(from), 'day') : 0;
  const isLargeRange = rangeDays > LARGE_RANGE_DAYS;

  const query = useMemo(() => {
    if (!rangeIsValid) return null;
    return {
      from: dayjs(from).startOf('day').toISOString(),
      to: dayjs(to).endOf('day').toISOString(),
    };
  }, [from, to, rangeIsValid]);

  const { response, isLoading } = useFind('stats', query ?? undefined, {
    enabled: !!query,
  });

  const stats: StatsResponse | null = query ? (response as StatsResponse) : null;
  const hasData = stats?.studyTypeCounts && stats.studyTypeCounts.length > 0;

  const barChartData = useMemo(() => {
    if (!stats?.studyTypeCounts) return [];
    return stats.studyTypeCounts.map(row => ({
      type: getLabel(row.studyType),
      [t('stats.count')]: row.count,
    }));
  }, [stats, getLabel, t]);

  const ageChartData = useMemo(() => {
    if (!stats?.ageGroups || stats.ageGroups.length === 0) return [];

    const bucketMap = new Map<string, Record<string, string | number>>();

    for (const bucket of AGE_BUCKETS) {
      bucketMap.set(bucket, { bucket });
    }

    for (const entry of stats.ageGroups) {
      const row = bucketMap.get(entry.bucket);
      if (row) {
        row[getLabel(entry.studyType)] = entry.count;
      }
    }

    return Array.from(bucketMap.values());
  }, [stats, getLabel]);

  const ageChartSeries = useMemo(() => {
    if (!stats?.ageGroups) return [];

    const types = [...new Set(stats.ageGroups.map(e => e.studyType))];
    return types.map(type => ({
      name: getLabel(type),
      color: STUDY_TYPE_COLORS[type] || 'gray.6',
    }));
  }, [stats, getLabel]);

  const genderChartData = useMemo(() => {
    if (!stats?.genderGroups || stats.genderGroups.length === 0) return [];

    const byType = new Map<string, Record<string, string | number>>();
    for (const row of stats.genderGroups) {
      if (!byType.has(row.studyType)) {
        byType.set(row.studyType, { type: getLabel(row.studyType) });
      }
      const entry = byType.get(row.studyType)!;
      entry[t(`stats.gender_${row.gender}`)] = row.count;
    }

    return Array.from(byType.values());
  }, [stats, getLabel, t]);

  const genderChartSeries = useMemo(
    () => [
      { name: t('stats.gender_male'), color: 'blue.6' },
      { name: t('stats.gender_female'), color: 'pink.6' },
      { name: t('stats.gender_other'), color: 'violet.6' },
    ],
    [t]
  );

  const studiesOverTimeChartData = useMemo(() => {
    if (!stats?.studiesOverTime) return [];

    return stats.studiesOverTime.map(row => ({
      period: dayjs(row.period).format('YYYY-MM-DD'),
      [t('stats.count')]: row.count,
    }));
  }, [stats, t]);

  const noOrderDonutData = useMemo(() => {
    if (!stats?.noOrderRate) return [];

    const withOrder = Math.max(stats.noOrderRate.total - stats.noOrderRate.noOrder, 0);
    return [
      { name: t('stats.no_order_with'), value: withOrder, color: 'teal.6' },
      { name: t('stats.no_order_without'), value: stats.noOrderRate.noOrder, color: 'orange.6' },
    ];
  }, [stats, t]);

  const completionDonutData = useMemo(() => {
    if (!stats?.completionRate) return [];

    const pending = Math.max(stats.completionRate.total - stats.completionRate.withResults, 0);
    return [
      {
        name: t('stats.completion_with_results'),
        value: stats.completionRate.withResults,
        color: 'green.6',
      },
      { name: t('stats.completion_pending'), value: pending, color: 'gray.6' },
    ];
  }, [stats, t]);

  const nationalityChartData = useMemo(() => {
    if (!stats?.nationalityDistribution) return [];

    return [...stats.nationalityDistribution]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(row => ({
        nationality: countries[row.nationality] ?? row.nationality,
        [t('stats.count')]: row.count,
      }));
  }, [countries, stats, t]);

  return (
    <Stack gap="lg" p={{ base: '1rem', md: '2rem' }}>
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%">
          <ToolbarTitle title={t('stats.title')} />
          <Group align="center" justify="center" gap="md" wrap="wrap">
            <Text c="dimmed">{t('stats.date_range')}</Text>
            <DatePickerInput
              type="range"
              value={dateRange}
              onChange={setDateRange}
              maxDate={dayjs().format('YYYY-MM-DD')}
              clearable={false}
            />
            {isLoading && <Loader size="sm" />}
          </Group>
        </Group>
      </Portal>

      {isLargeRange && (
        <Alert icon={<Info size={16} />} color="yellow" variant="light" mt="sm">
          {t('stats.large_range_warning')}
        </Alert>
      )}

      {!rangeIsValid && !isLoading && (
        <Text c="dimmed" ta="center">
          {t('stats.no_data')}
        </Text>
      )}

      {rangeIsValid && !isLoading && !hasData && (
        <Text c="dimmed" ta="center">
          {t('stats.no_data')}
        </Text>
      )}

      {hasData && (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {noOrderDonutData.length > 0 && (
              <Paper p="md" withBorder>
                <Text fw={600} mb="md">
                  {t('stats.no_order_rate')}
                </Text>
                <Group justify="space-between" align="center">
                  <DonutChart data={noOrderDonutData} />
                  <Text fw={700}>{(stats?.noOrderRate?.rate || 0) * 100}%</Text>
                </Group>
              </Paper>
            )}

            <Paper p="md" withBorder>
              <Text fw={600} mb="md">
                {t('stats.avg_studies_per_patient')}
              </Text>
              <Text size="2rem" fw={700}>
                {stats?.avgStudiesPerPatient || 0}
              </Text>
            </Paper>

            {completionDonutData.length > 0 && (
              <Paper p="md" withBorder>
                <Text fw={600} mb="md">
                  {t('stats.completion_rate')}
                </Text>
                <Group justify="space-between" align="center">
                  <DonutChart data={completionDonutData} />
                  <Text fw={700}>{(stats?.completionRate?.rate || 0) * 100}%</Text>
                </Group>
              </Paper>
            )}
          </SimpleGrid>

          <Paper p="md" withBorder>
            <Text fw={600} mb="md">
              {t('stats.study_type_totals')}
            </Text>
            <BarChart
              h={300}
              data={barChartData}
              dataKey="type"
              series={[{ name: t('stats.count'), color: 'teal.6' }]}
              tickLine="y"
            />
          </Paper>

          {ageChartSeries.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="md">
                {t('stats.age_groups')}
              </Text>
              <BarChart
                h={300}
                data={ageChartData}
                dataKey="bucket"
                type="stacked"
                series={ageChartSeries}
                tickLine="y"
              />
            </Paper>
          )}

          {genderChartData.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="md">
                {t('stats.gender_breakdown')}
              </Text>
              <BarChart
                h={300}
                data={genderChartData}
                dataKey="type"
                type="stacked"
                series={genderChartSeries}
                tickLine="y"
              />
            </Paper>
          )}

          {studiesOverTimeChartData.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="md">
                {t('stats.studies_over_time')}
              </Text>
              <AreaChart
                h={300}
                data={studiesOverTimeChartData}
                dataKey="period"
                series={[{ name: t('stats.count'), color: 'cyan.6' }]}
                tickLine="y"
              />
            </Paper>
          )}

          {nationalityChartData.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="md">
                {t('stats.nationality_distribution')}
              </Text>
              <BarChart
                h={300}
                data={nationalityChartData}
                dataKey="nationality"
                series={[{ name: t('stats.count'), color: 'indigo.6' }]}
                tickLine="y"
              />
            </Paper>
          )}
        </>
      )}
    </Stack>
  );
}
