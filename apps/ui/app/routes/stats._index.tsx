import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Group, Text, Loader, Alert, Paper, SimpleGrid } from '@mantine/core';
import { AreaChart, BarChart, DonutChart } from '@mantine/charts';
import { InfoIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import Joyride from 'react-joyride';

import { authenticatedLoader } from '~/utils/auth.server';
import { useFind } from '~/components/provider';
import Portal from '~/components/portal';
import { ToolbarTitle } from '~/components/toolbar-title';
import { DateRangeFilterState, DateRangePopover, resolveDateRange } from '~/components/date-range-popover';
import { useSectionTour } from '~/components/guided-tour/use-section-tour';
import { getStatsSteps } from '~/components/guided-tour/tour-steps/stats-steps';
import TourTooltip from '~/components/guided-tour/tour-tooltip';

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
const MIN_RANGE_START = '1900-01-01';

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

interface InsurerDistributionEntry {
  insurer: string;
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
  insurerDistribution: InsurerDistributionEntry[];
}

export default function StatsIndex() {
  const { t } = useTranslation();
  const countries = useMemo(() => t('countries', { returnObjects: true }) as Record<string, string>, [t]);
  const formatPercent = useCallback((value: number) => `${(value * 100).toFixed(2)}%`, []);
  const getLabel = useCallback(
    (type: string) => {
      const key = `stats.type_${type}`;
      return t(key, { defaultValue: type });
    },
    [t]
  );

  const [rangeFilter, setRangeFilter] = useState<DateRangeFilterState>({
    mode: 'in_last',
    lastAmount: 30,
    lastUnit: 'day',
    singleDate: dayjs().format('YYYY-MM-DD'),
    betweenRange: [dayjs().subtract(30, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
  });

  const resolvedRange = useMemo(
    () =>
      resolveDateRange(rangeFilter, {
        minRangeStart: MIN_RANGE_START,
        maxDate: dayjs().format('YYYY-MM-DD'),
        precision: 'day',
      }),
    [rangeFilter]
  );

  const rangeIsValid = !!resolvedRange;
  const rangeDays = resolvedRange ? resolvedRange.to.diff(resolvedRange.from, 'day') : 0;
  const isLargeRange = rangeDays > LARGE_RANGE_DAYS;
  const trendDateFormat = rangeDays >= 365 ? 'YYYY-MM' : 'YYYY-MM-DD';

  const handleApplyRange = useCallback((nextState: DateRangeFilterState) => {
    setRangeFilter(nextState);
  }, []);

  const query = useMemo(() => {
    if (!resolvedRange) return null;
    return {
      from: resolvedRange.from.toISOString(),
      to: resolvedRange.to.toISOString(),
    };
  }, [resolvedRange]);

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
      period: dayjs(row.period).format(trendDateFormat),
      [t('stats.count')]: row.count,
    }));
  }, [stats, t, trendDateFormat]);

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

  const insurerChartData = useMemo(() => {
    if (!stats?.insurerDistribution) return [];

    return stats.insurerDistribution.slice(0, 15).map(row => ({
      insurer: row.insurer,
      [t('stats.count')]: row.count,
    }));
  }, [stats, t]);

  const tourSteps = getStatsSteps(t);
  const { run, stepIndex, handleCallback } = useSectionTour('stats', tourSteps);

  return (
    <Stack gap="lg" p={{ base: '1rem', md: '2rem' }}>
      <Joyride
        steps={tourSteps}
        run={run}
        stepIndex={stepIndex}
        callback={handleCallback}
        continuous
        showSkipButton
        disableOverlayClose={false}
        tooltipComponent={TourTooltip}
        styles={{ options: { zIndex: 10000 } }}
      />
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%">
          <ToolbarTitle title={t('stats.title')} />
          <Group align="center" justify="center" gap="md" wrap="wrap">
            <Text c="dimmed">{t('stats.date_range')}</Text>
            <div data-tour="stats-date-range">
              <DateRangePopover
                value={rangeFilter}
                onApply={handleApplyRange}
                minRangeStart={MIN_RANGE_START}
                maxDate={dayjs().format('YYYY-MM-DD')}
                precision="day"
                variant="filled"
              />
            </div>
            {isLoading && <Loader size="sm" />}
          </Group>
        </Group>
      </Portal>

      {isLargeRange && (
        <Alert icon={<InfoIcon size={16} />} color="yellow" variant="light">
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
                  <Text fw={700}>{formatPercent(stats?.noOrderRate?.rate || 0)}</Text>
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
                  <Text fw={700}>{formatPercent(stats?.completionRate?.rate || 0)}</Text>
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

          {insurerChartData.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} mb="md">
                {t('stats.studies_by_insurer')}
              </Text>
              <BarChart
                h={400}
                data={insurerChartData}
                dataKey="insurer"
                series={[{ name: t('stats.count'), color: 'violet.6' }]}
                tickLine="y"
              />
            </Paper>
          )}

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
