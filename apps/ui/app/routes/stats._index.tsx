import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Group, Text, Loader, Alert, Paper } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { BarChart } from '@mantine/charts';
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

interface StatsResponse {
  studyTypeCounts: StudyTypeCount[];
  ageGroups: AgeGroupEntry[];
}

export default function StatsIndex() {
  const { t } = useTranslation();
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
        </>
      )}
    </Stack>
  );
}
