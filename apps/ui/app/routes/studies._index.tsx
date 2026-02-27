import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Search, Plus } from 'lucide-react';
import { Link, useLoaderData, useSearchParams } from '@remix-run/react';
import { TextInput, Stack, Loader, Group, Button, Autocomplete, Select } from '@mantine/core';
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

interface PrepagaResponse {
  data: Prepaga[];
  total: number;
  limit: number;
  skip: number;
}

const STUDY_TYPES = ['anemia', 'anticoagulation', 'compatibility', 'hemostasis', 'myelogram', 'thrombophilia'] as const;

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
  return json({ isVerified });
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
  const { isVerified } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialSearch);
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery(media.md);

  // -------------------------------------------------------------------------
  // Filter state
  // -------------------------------------------------------------------------

  const [selectedInsurerId, setSelectedInsurerId] = useState<string | null>(null);
  const [insurerSearch, setInsurerSearch] = useState('');
  const [debouncedInsurerSearch] = useDebouncedValue(insurerSearch, 300);

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
  // Insurer autocomplete — live DB search
  // -------------------------------------------------------------------------

  const shouldSearchInsurers = debouncedInsurerSearch.length >= 2;

  const insurerQuery = useMemo(
    () => (shouldSearchInsurers ? { $search: debouncedInsurerSearch, $limit: 20, $sort: { shortName: 1 } } : undefined),
    [debouncedInsurerSearch, shouldSearchInsurers]
  );

  const { response: insurerResponse } = useFind('prepagas', insurerQuery, { enabled: shouldSearchInsurers });

  const insurerResults: Prepaga[] = useMemo(() => {
    if (!shouldSearchInsurers) return [];
    const raw = insurerResponse as PrepagaResponse | Prepaga[];
    return Array.isArray(raw) ? raw : (raw?.data ?? []);
  }, [shouldSearchInsurers, insurerResponse]);

  const insurerAutocompleteData = useMemo(() => insurerResults.map(p => p.shortName), [insurerResults]);

  const insurerByName = useMemo(() => new Map(insurerResults.map(p => [p.shortName, p.id])), [insurerResults]);

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

  const handleInsurerChange = useCallback(
    (value: string) => {
      setInsurerSearch(value);
      if (!value) {
        setSelectedInsurerId(null);
        setPage(1);
      }
    },
    [setPage]
  );

  const handleInsurerOptionSubmit = useCallback(
    (value: string) => {
      const id = insurerByName.get(value) ?? null;
      if (id) {
        setSelectedInsurerId(id);
        setInsurerSearch(value);
        setPage(1);
      }
    },
    [insurerByName, setPage]
  );

  const handleApplyRange = useCallback(
    (nextState: DateRangeFilterState, range: ResolvedDateRange) => {
      setRangeFilter(nextState);
      setActiveRange(range);
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
      q.date = {
        $gte: dayjs(activeRange.from).format('YYYY-MM-DD'),
        $lte: dayjs(activeRange.to).format('YYYY-MM-DD'),
      };
    }

    if (selectedInsurerId) {
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
              <Autocomplete
                data={insurerAutocompleteData}
                value={insurerSearch}
                onChange={handleInsurerChange}
                onOptionSubmit={handleInsurerOptionSubmit}
                placeholder={t('studies.filter_insurer', { defaultValue: 'Insurer' })}
                comboboxProps={{ withinPortal: true }}
                maxDropdownHeight={300}
                w={200}
              />
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
          <Autocomplete
            data={insurerAutocompleteData}
            value={insurerSearch}
            onChange={handleInsurerChange}
            onOptionSubmit={handleInsurerOptionSubmit}
            placeholder={t('studies.filter_insurer', { defaultValue: 'Insurer' })}
            comboboxProps={{ withinPortal: true }}
            maxDropdownHeight={300}
            size="xs"
            w={180}
            styles={{ input: { minHeight: 32 } }}
          />
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
