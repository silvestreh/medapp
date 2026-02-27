import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { Link, useLoaderData, useSearchParams } from '@remix-run/react';
import { TextInput, Stack, Loader, Group, Button, Menu, Select } from '@mantine/core';
import dayjs from 'dayjs';

import { useFind } from '~/components/provider';
import { authenticatedLoader, getAuthenticatedClient, isMedicVerified } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { media } from '~/media';
import { StudiesTable, toStudyItems } from '~/components/studies-table';
import type { Study } from '~/components/studies-table';
import { Fab } from '~/components/fab';
import {
  DateRangePopover,
  resolveDateRange,
  type DateRangeFilterState,
  type ResolvedDateRange,
} from '~/components/date-range-popover';

type Prepaga = {
  id: string;
  shortName: string;
  denomination: string;
};

const STUDY_TYPES = [
  'anemia',
  'anticoagulation',
  'compatibility',
  'hemostasis',
  'myelogram',
  'thrombophilia',
] as const;

const STUDY_TYPE_I18N: Record<string, string> = {
  anemia: 'studies.type_anemia',
  anticoagulation: 'studies.type_anticoagulation',
  compatibility: 'studies.type_compatibility',
  hemostasis: 'studies.type_hemostasis',
  myelogram: 'studies.type_myelogram',
  thrombophilia: 'studies.type_thrombophilia',
};

const MIN_RANGE_START = '1900-01-01';

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const isVerified = await isMedicVerified(client, String((user as any).id), (user as any).roleId);

  const prepagasResponse = await client.service('prepagas').find({
    query: { $limit: 500, $sort: { shortName: 1 } },
  });
  const insurers = (
    Array.isArray(prepagasResponse)
      ? prepagasResponse
      : ((prepagasResponse as { data?: unknown[] }).data ?? [])
  ) as Prepaga[];

  return json({ isVerified, insurers });
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginatedResponse {
  data: Study[];
  total: number;
  limit: number;
  skip: number;
}

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudiesIndex() {
  const { t } = useTranslation();
  const { isVerified, insurers } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialSearch);
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery(media.md);

  // -------------------------------------------------------------------------
  // Filter state
  // -------------------------------------------------------------------------

  const [selectedInsurerId, setSelectedInsurerId] = useState<string>('all');
  const [selectedStudyType, setSelectedStudyType] = useState<string | null>(null);
  const [rangeFilter, setRangeFilter] = useState<DateRangeFilterState>({
    mode: 'in_last',
    lastAmount: 6,
    lastUnit: 'month',
    singleDate: dayjs().format('YYYY-MM-DD'),
    betweenRange: [dayjs().subtract(6, 'month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
  });
  const [activeRange, setActiveRange] = useState<ResolvedDateRange | null>(() =>
    resolveDateRange(rangeFilter, {
      minRangeStart: MIN_RANGE_START,
      maxDate: dayjs().format('YYYY-MM-DD'),
      precision: 'day',
    })
  );

  // -------------------------------------------------------------------------
  // URL sync for search
  // -------------------------------------------------------------------------

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    let changed = false;

    if (debouncedInputValue !== (searchParams.get('q') || '')) {
      if (debouncedInputValue) {
        newParams.set('q', debouncedInputValue);
      } else {
        newParams.delete('q');
      }
      newParams.delete('page');
      changed = true;
    }

    if (changed) {
      setSearchParams(newParams, { replace: true, preventScrollReset: true });
    }
  }, [debouncedInputValue, setSearchParams, searchParams]);

  const page = parseInt(searchParams.get('page') || '1', 10);

  const setPage = useCallback(
    (newPage: number) => {
      const newParams = new URLSearchParams(searchParams);
      if (newPage > 1) {
        newParams.set('page', newPage.toString());
      } else {
        newParams.delete('page');
      }
      setSearchParams(newParams, { replace: true, preventScrollReset: true });
    },
    [searchParams, setSearchParams]
  );

  // -------------------------------------------------------------------------
  // Filter handlers
  // -------------------------------------------------------------------------

  const handleApplyRange = useCallback(
    (nextState: DateRangeFilterState, range: ResolvedDateRange) => {
      setRangeFilter(nextState);
      setActiveRange(range);
      setPage(1);
    },
    [setPage]
  );

  const handleSelectInsurer = useCallback(
    (id: string) => {
      setSelectedInsurerId(id);
      setPage(1);
    },
    [setPage]
  );

  const handleSelectStudyType = useCallback(
    (value: string | null) => {
      setSelectedStudyType(value);
      setPage(1);
    },
    [setPage]
  );

  const selectedInsurerLabel = useMemo(() => {
    if (selectedInsurerId === 'all') return t('common.all', { defaultValue: 'All' });
    const found = insurers.find((i: Prepaga) => i.id === selectedInsurerId);
    return found ? found.shortName : t('common.all', { defaultValue: 'All' });
  }, [selectedInsurerId, insurers, t]);

  const studyTypeOptions = useMemo(
    () =>
      STUDY_TYPES.map(key => ({
        value: key,
        label: t(STUDY_TYPE_I18N[key], { defaultValue: key }),
      })),
    [t]
  );

  // -------------------------------------------------------------------------
  // Studies query
  // -------------------------------------------------------------------------

  const query = useMemo(() => {
    const q: Record<string, unknown> = {
      $sort: { createdAt: -1 },
      $limit: PAGE_SIZE,
      $skip: (page - 1) * PAGE_SIZE,
    };

    if (debouncedInputValue) {
      q.q = debouncedInputValue;
    }

    if (activeRange) {
      q.dateFrom = dayjs(activeRange.from).format('YYYY-MM-DD');
      q.dateTo = dayjs(activeRange.to).format('YYYY-MM-DD');
    }

    if (selectedInsurerId !== 'all') {
      q.insurerId = selectedInsurerId;
    }

    if (selectedStudyType) {
      q.studyType = selectedStudyType;
    }

    return q;
  }, [debouncedInputValue, page, activeRange, selectedInsurerId, selectedStudyType]);

  const { response, isLoading } = useFind('studies', query);
  const { data: studies = [], total = 0 } = response as PaginatedResponse;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const studyItems = toStudyItems(studies);

  return (
    <Stack gap={0}>
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%" wrap="nowrap">
          <TextInput
            ref={inputRef}
            autoFocus
            placeholder={t('studies.search_placeholder')}
            value={inputValue}
            onChange={event => setInputValue(event.currentTarget.value)}
            leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
            flex={1}
            size="lg"
            variant="unstyled"
            styles={{ input: { lineHeight: 1, height: 'auto', minHeight: 0 } }}
            autoComplete="off"
            data-1p-ignore
          />
          {isDesktop && (
            <Group gap="sm" wrap="nowrap">
              <Select
                data={studyTypeOptions}
                value={selectedStudyType}
                onChange={handleSelectStudyType}
                placeholder={t('studies.filter_study_type', { defaultValue: 'Study type' })}
                clearable
                comboboxProps={{ withinPortal: true }}
                w={160}
              />
              <Menu shadow="md" width={260}>
                <Menu.Target>
                  <Button variant="default" rightSection={<ChevronDown size={14} />}>
                    {selectedInsurerLabel}
                  </Button>
                </Menu.Target>
                <Menu.Dropdown mah={300} style={{ overflowY: 'auto' }}>
                  <Menu.Label>{t('studies.filter_insurer', { defaultValue: 'Insurer' })}</Menu.Label>
                  <Menu.Item
                    onClick={() => handleSelectInsurer('all')}
                    fw={selectedInsurerId === 'all' ? 700 : 400}
                  >
                    {t('common.all', { defaultValue: 'All' })}
                  </Menu.Item>
                  <Menu.Divider />
                  {insurers.map((insurer: Prepaga) => (
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
              />
              {isVerified && (
                <Button component={Link} to="/studies/new" leftSection={<Plus size={16} />}>
                  {t('studies.new_study')}
                </Button>
              )}
            </Group>
          )}
        </Group>
      </Portal>

      {!isDesktop && (
        <Group gap="xs" px="sm" py="xs" wrap="nowrap" style={{ overflowX: 'auto' }}>
          <Select
            data={studyTypeOptions}
            value={selectedStudyType}
            onChange={handleSelectStudyType}
            placeholder={t('studies.filter_study_type', { defaultValue: 'Study type' })}
            clearable
            comboboxProps={{ withinPortal: true }}
            size="xs"
            w={140}
            styles={{ input: { minHeight: 32 } }}
          />
          <Menu shadow="md" width={260}>
            <Menu.Target>
              <Button variant="default" size="xs" rightSection={<ChevronDown size={12} />}>
                {selectedInsurerLabel}
              </Button>
            </Menu.Target>
            <Menu.Dropdown mah={300} style={{ overflowY: 'auto' }}>
              <Menu.Label>{t('studies.filter_insurer', { defaultValue: 'Insurer' })}</Menu.Label>
              <Menu.Item
                onClick={() => handleSelectInsurer('all')}
                fw={selectedInsurerId === 'all' ? 700 : 400}
              >
                {t('common.all', { defaultValue: 'All' })}
              </Menu.Item>
              <Menu.Divider />
              {insurers.map((insurer: Prepaga) => (
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
          />
        </Group>
      )}

      {!isDesktop && isVerified && <Fab to="/studies/new" />}

      <StudiesTable
        items={studyItems}
        isDesktop={!!isDesktop}
        isLoading={isLoading}
        searchValue={inputValue}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onEmptyClick={() => inputRef.current?.focus()}
      />
    </Stack>
  );
}
