import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useClickOutside, useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, PlusIcon, FunnelIcon } from '@phosphor-icons/react';
import { Link, useLoaderData, useSearchParams } from '@remix-run/react';
import { TextInput, Stack, Loader, Group, Button, Autocomplete, Select, Popover } from '@mantine/core';
import dayjs from 'dayjs';

import Joyride from 'react-joyride';

import { useFind, useFeathers } from '~/components/provider';
import { getCurrentOrganizationId } from '~/session';
import Portal from '~/components/portal';
import { media } from '~/media';
import { StudiesTable, toStudyItems } from '~/components/studies-table';
import type { Study } from '~/components/studies-table';
import { Fab } from '~/components/fab';
import { styled } from '~/styled-system/jsx';
import { useSectionTour } from '~/components/guided-tour/use-section-tour';
import { getStudiesSteps } from '~/components/guided-tour/tour-steps/studies-steps';
import TourTooltip from '~/components/guided-tour/tour-tooltip';
import {
  authenticatedLoader,
  getAuthenticatedClient,
  isMedicVerified,
  getCurrentOrgRoleIds,
} from '~/utils/auth.server';
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

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',

    sm: {
      padding: '1em',
    },
    md: {
      padding: '2em 2em 1em',
    },
  },
});

const Title = styled('h1', {
  base: {
    fontSize: '1.5rem',
    lineHeight: 1,
    fontWeight: 700,
    flex: 1,
    margin: 0,

    md: {
      fontSize: '2rem',
    },

    lg: {
      fontSize: '2.25rem',
    },
  },
});

export const loader = authenticatedLoader(async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const orgId = await getCurrentOrganizationId(request);
  const orgRoleIds = getCurrentOrgRoleIds(user, orgId);
  const isVerified = isMedicVerified(user, orgRoleIds);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const q = url.searchParams.get('q') || '';

  const now = dayjs();
  const sixMonthsAgo = now.subtract(6, 'month');

  const query: Record<string, unknown> = {
    $sort: { createdAt: -1 },
    $limit: PAGE_SIZE,
    $skip: (page - 1) * PAGE_SIZE,
    date: {
      $gte: sixMonthsAgo.format('YYYY-MM-DD'),
      $lt: now.add(1, 'day').format('YYYY-MM-DD'),
    },
  };

  if (q) {
    query.q = q;
  }

  const studies = await client.service('studies').find({ query });

  return json({ isVerified, initialStudies: studies });
});

interface PaginatedResponse {
  data: Study[];
  total: number;
  limit: number;
  skip: number;
}

const PAGE_SIZE = 15;

export default function StudiesIndex() {
  const { t } = useTranslation();
  const { isVerified, initialStudies } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialSearch);
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery(media.lg);

  // -------------------------------------------------------------------------
  // Filter state
  // -------------------------------------------------------------------------

  const [selectedInsurerId, setSelectedInsurerId] = useState<string | null>(null);
  const [insurerSearch, setInsurerSearch] = useState('');
  const [debouncedInsurerSearch] = useDebouncedValue(insurerSearch, 300);

  const [selectedStudyType, setSelectedStudyType] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterTargetNode, setFilterTargetNode] = useState<HTMLDivElement | null>(null);
  const [filterDropdownNode, setFilterDropdownNode] = useState<HTMLDivElement | null>(null);
  const filtersPopoverRef = useClickOutside<HTMLDivElement>(
    () => setFiltersOpen(false),
    ['mousedown', 'touchstart'],
    [filterTargetNode, filterDropdownNode].filter(Boolean) as HTMLElement[]
  );
  const toggleFilters = useCallback(() => setFiltersOpen(prev => !prev), []);

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

  const feathers = useFeathers();
  const [insurerResults, setInsurerResults] = useState<Prepaga[]>([]);

  useEffect(() => {
    if (debouncedInsurerSearch.length < 2) {
      setInsurerResults([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await feathers.service('prepagas').find({
          query: { $search: debouncedInsurerSearch, $limit: 20, $sort: { shortName: 1 } },
        });
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setInsurerResults(list);
      } catch {
        if (!cancelled) setInsurerResults([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedInsurerSearch, feathers]);

  const insurerAutocompleteData = useMemo(() => [...new Set(insurerResults.map(p => p.shortName))], [insurerResults]);

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
        $lt: dayjs(activeRange.to).add(1, 'day').format('YYYY-MM-DD'),
      };
    }

    if (selectedInsurerId) {
      q.insurerId = selectedInsurerId;
    }

    if (selectedStudyType) {
      q.studies = { $contains: [selectedStudyType] };
    }

    return q;
  }, [debouncedInputValue, page, activeRange, selectedInsurerId, selectedStudyType]);

  const { response, isLoading } = useFind('studies', query);
  const findResult = response as PaginatedResponse;
  // useFind returns { data: [] } as fallback before SWR resolves; real responses have `total`
  const hasFetched = 'total' in findResult;
  const { data: studies = [], total = 0 } = hasFetched ? findResult : (initialStudies as PaginatedResponse);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const studyItems = toStudyItems(studies);

  const tourSteps = getStudiesSteps(t);
  const { run: tourRun, stepIndex: tourStepIndex, handleCallback: tourHandleCallback } = useSectionTour('studies', tourSteps);

  return (
    <Stack gap={0}>
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
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%" wrap="nowrap">
          <TextInput
            ref={inputRef}
            autoFocus
            placeholder={t('studies.search_placeholder')}
            value={inputValue}
            onChange={event => setInputValue(event.currentTarget.value)}
            leftSection={isLoading ? <Loader size={16} /> : <MagnifyingGlassIcon size={16} />}
            flex={1}
            size="lg"
            variant="unstyled"
            styles={{ input: { lineHeight: 1, height: 'auto', minHeight: 0 } }}
            autoComplete="off"
            data-1p-ignore
            data-tour="studies-search"
          />
          {isDesktop && (
            <Group gap="sm" wrap="nowrap" data-tour="studies-filters">
              <Select
                data={studyTypeOptions}
                value={selectedStudyType}
                onChange={handleSelectStudyType}
                placeholder={t('studies.filter_study_type', { defaultValue: 'Study type' })}
                clearable
                comboboxProps={{ withinPortal: true }}
                variant="filled"
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
                variant="filled"
                clearable
              />
              <DateRangePopover
                value={rangeFilter}
                onApply={handleApplyRange}
                minRangeStart={MIN_RANGE_START}
                maxDate={dayjs().format('YYYY-MM-DD')}
                precision="day"
                variant="filled"
              />
              {isVerified && (
                <Button data-tour="studies-new" component={Link} to="/studies/new" leftSection={<PlusIcon size={16} />}>
                  {t('studies.new_study')}
                </Button>
              )}
            </Group>
          )}
        </Group>
      </Portal>

      {!isDesktop && isVerified && <Fab to="/studies/new" />}

      <HeaderContainer>
        <Title>{t('studies.title')}</Title>

        {!isDesktop && (
          <div ref={filtersPopoverRef}>
            <Popover
              opened={filtersOpen}
              onChange={setFiltersOpen}
              position="bottom-end"
              withArrow
              closeOnClickOutside={false}
            >
              <Popover.Target>
                <div ref={setFilterTargetNode}>
                  <Button variant="default" leftSection={<FunnelIcon size={16} />} onClick={toggleFilters}>
                    {t('common.filters')}
                  </Button>
                </div>
              </Popover.Target>
              <Popover.Dropdown ref={setFilterDropdownNode}>
                <Stack gap="xs">
                  <Select
                    data={studyTypeOptions}
                    value={selectedStudyType}
                    onChange={handleSelectStudyType}
                    placeholder={t('studies.filter_study_type', { defaultValue: 'Study type' })}
                    clearable
                    comboboxProps={{ withinPortal: false }}
                    styles={{ input: { minHeight: 32 } }}
                  />
                  <Autocomplete
                    data={insurerAutocompleteData}
                    value={insurerSearch}
                    onChange={handleInsurerChange}
                    onOptionSubmit={handleInsurerOptionSubmit}
                    placeholder={t('studies.filter_insurer', { defaultValue: 'Insurer' })}
                    comboboxProps={{ withinPortal: false }}
                    maxDropdownHeight={300}
                    styles={{ input: { minHeight: 32 } }}
                    clearable
                  />
                  <DateRangePopover
                    value={rangeFilter}
                    onApply={handleApplyRange}
                    minRangeStart={MIN_RANGE_START}
                    maxDate={dayjs().format('YYYY-MM-DD')}
                    precision="day"
                    withinPortal={false}
                    fullWidth
                  />
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </div>
        )}
      </HeaderContainer>

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
