import { useState, useMemo, useEffect, useRef } from 'react';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Search, Plus } from 'lucide-react';
import { Link, useSearchParams } from '@remix-run/react';
import { TextInput, Stack, Loader, Group, Button, ActionIcon } from '@mantine/core';

import { useFind } from '~/components/provider';
import { authenticatedLoader } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { media } from '~/media';
import { StudiesTable, toStudyItems } from '~/components/studies-table';
import type { Study } from '~/components/studies-table';

export const loader = authenticatedLoader();

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
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialSearch);
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery(media.md);

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

  const setPage = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (newPage > 1) {
      newParams.set('page', newPage.toString());
    } else {
      newParams.delete('page');
    }
    setSearchParams(newParams, { replace: true, preventScrollReset: true });
  };

  // -------------------------------------------------------------------------
  // Studies query — search is handled entirely server-side
  // -------------------------------------------------------------------------

  const query = useMemo(
    () => ({
      $sort: { createdAt: -1 },
      $limit: PAGE_SIZE,
      $skip: (page - 1) * PAGE_SIZE,
      ...(debouncedInputValue ? { q: debouncedInputValue } : {}),
    }),
    [debouncedInputValue, page]
  );

  const { response, isLoading } = useFind('studies', query);
  const { data: studies = [], total = 0 } = response as PaginatedResponse;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const studyItems = toStudyItems(studies);

  return (
    <Stack gap={0}>
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%">
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
            <Button component={Link} to="/studies/new" leftSection={<Plus size={16} />}>
              {t('studies.new_study')}
            </Button>
          )}
          {!isDesktop && (
            <ActionIcon component={Link} to="/studies/new">
              <Plus size={16} />
            </ActionIcon>
          )}
        </Group>
      </Portal>

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
