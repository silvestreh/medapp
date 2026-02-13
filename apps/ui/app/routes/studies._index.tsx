import { useState, useMemo, useEffect, useRef } from 'react';
import { Table, TextInput, Stack, Loader, Text as BaseText, Pagination, Group, Badge, Button } from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Search, FlaskConical, Plus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from '@remix-run/react';
import dayjs from 'dayjs';

import { useFind } from '~/components/provider';
import { authenticatedLoader } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { displayDocumentValue } from '~/utils';
import { media } from '~/media';

export const loader = authenticatedLoader();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonalData {
  firstName?: string;
  lastName?: string;
  documentType?: string;
  documentValue?: string;
  nationality?: string;
  maritalStatus?: string;
  birthDate?: string;
  gender?: string;
}

interface Patient {
  id: string;
  medicare?: string;
  medicareNumber?: string;
  medicarePlan?: string;
  personalData?: PersonalData;
}

interface StudyResult {
  id: string;
  data?: unknown;
  studyId: string;
  type: string;
}

interface Study {
  id: string;
  date?: string;
  protocol: number;
  studies: string[];
  noOrder: boolean;
  medicId: string;
  patientId: string;
  patient?: Patient;
  results?: StudyResult[];
}

interface PaginatedResponse {
  data: Study[];
  total: number;
  limit: number;
  skip: number;
}

interface StudyItem {
  study: Study;
  firstName: string;
  lastName: string;
  dni?: string;
  medicare: string;
  hasResults: boolean;
}

// ---------------------------------------------------------------------------
// Study type badge config
// ---------------------------------------------------------------------------

const STUDY_TYPE_BADGES: Record<string, { short: string; color: string }> = {
  anemia: { short: 'EA', color: 'green' },
  anticoagulation: { short: 'EAC', color: 'blue' },
  hemostasis: { short: 'CCH', color: 'teal' },
  myelogram: { short: 'MD', color: 'violet' },
  thrombophilia: { short: 'PT', color: 'orange' },
  compatibility: { short: 'PCM', color: 'pink' },
};

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Wrapper = styled('div', {
  base: {},
});

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFBFB',

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

const EmptyState = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: '4px',
    padding: 'var(--mantine-spacing-xl)',
  },
});

const Card = styled('div', {
  base: {
    background: 'white',
    border: '1px solid var(--mantine-color-gray-2)',
    borderRadius: 'var(--mantine-radius-md)',
    padding: 'var(--mantine-spacing-sm)',
    cursor: 'pointer',
    '&:active': {
      background: 'var(--mantine-color-gray-0)',
    },
  },
});

const CardRow = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
  },
});

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
  const navigate = useNavigate();
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

  const studyItems: StudyItem[] = studies.map(study => {
    const patient = study.patient;
    const firstName = patient?.personalData?.firstName || '';
    const lastName = patient?.personalData?.lastName || '';
    const dni = patient?.personalData?.documentValue;
    const medicare = patient?.medicare || '';
    const hasResults = (study.results ?? []).length > 0;

    return { study, firstName, lastName, dni, medicare, hasResults };
  });

  const tableRows = studyItems.map(item => (
    <Table.Tr
      key={item.study.id}
      styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
      onClick={() => navigate(`/studies/${item.study.id}`)}
      style={{
        cursor: 'pointer',
        opacity: item.study.noOrder ? 0.7 : 1,
        backgroundColor: !item.hasResults ? 'var(--mantine-color-yellow-0)' : undefined,
      }}
    >
      <Table.Td>
        <CellText style={{ fontWeight: 600 }}>#{item.study.protocol}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>
          {item.firstName} {item.lastName}
        </CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{displayDocumentValue(item.dni)}</CellText>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="wrap">
          {item.study.studies.map(type => {
            const badge = STUDY_TYPE_BADGES[type];
            if (!badge) return null;
            return (
              <Badge key={type} size="xs" color={badge.color} variant="filled">
                {badge.short}
              </Badge>
            );
          })}
        </Group>
      </Table.Td>
      <Table.Td>
        <CellText>{item.medicare}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{item.study.date ? dayjs(item.study.date).format('DD/MM/YYYY') : '—'}</CellText>
      </Table.Td>
    </Table.Tr>
  ));

  const mobileCards = studyItems.map(item => (
    <Card
      key={item.study.id}
      onClick={() => navigate(`/studies/${item.study.id}`)}
      style={{
        opacity: item.study.noOrder ? 0.7 : 1,
        backgroundColor: !item.hasResults ? 'var(--mantine-color-yellow-0)' : undefined,
      }}
    >
      <CardRow>
        <BaseText fw={600} size="sm">
          {item.firstName} {item.lastName}
        </BaseText>
        <BaseText size="xs" c="dimmed">
          #{item.study.protocol}
        </BaseText>
      </CardRow>

      <CardRow style={{ marginTop: 4 }}>
        <BaseText size="xs" c="dimmed">
          {displayDocumentValue(item.dni)}
        </BaseText>
        <BaseText size="xs" c="dimmed">
          {item.study.date ? dayjs(item.study.date).format('DD/MM/YYYY') : '—'}
        </BaseText>
      </CardRow>

      <CardRow style={{ marginTop: 8 }}>
        <Group gap={4} wrap="wrap">
          {item.study.studies.map(type => {
            const badge = STUDY_TYPE_BADGES[type];
            if (!badge) return null;
            return (
              <Badge key={type} size="xs" color={badge.color} variant="filled">
                {badge.short}
              </Badge>
            );
          })}
        </Group>
        {item.medicare && (
          <BaseText size="xs" c="dimmed">
            {item.medicare}
          </BaseText>
        )}
      </CardRow>
    </Card>
  ));

  const emptyState = (
    <EmptyState onClick={() => inputRef.current?.focus()} style={{ cursor: 'pointer' }}>
      {inputValue && !isLoading ? (
        <FlaskConical size={48} color="var(--mantine-color-dimmed)" />
      ) : (
        <Search size={48} color="var(--mantine-color-dimmed)" />
      )}
      <BaseText c="dimmed" ta="center">
        {inputValue && !isLoading ? t('studies.no_results') : t('studies.search_prompt')}
      </BaseText>
    </EmptyState>
  );

  return (
    <Stack>
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
          />
          <Button component={Link} to="/studies/new" leftSection={<Plus size={16} />}>
            {t('studies.new_study')}
          </Button>
        </Group>
      </Portal>

      {isDesktop ? (
        <Wrapper>
          <HeaderContainer>
            <Title>{t('studies.title')}</Title>
          </HeaderContainer>
          <Table highlightOnHover layout="fixed" bg="white">
            {tableRows.length > 0 && (
              <Table.Thead>
                <Table.Tr bg="blue.0">
                  <Table.Th
                    w={100}
                    style={{ border: '1px solid var(--mantine-color-blue-1)', borderLeft: 'none' }}
                    fw={500}
                    fz="md"
                    py="0.5em"
                  >
                    {t('studies.col_protocol')}
                  </Table.Th>
                  <Table.Th style={{ border: '1px solid var(--mantine-color-blue-1)' }} fw={500} fz="md" py="0.5em">
                    {t('studies.col_patient')}
                  </Table.Th>
                  <Table.Th
                    w={180}
                    style={{ border: '1px solid var(--mantine-color-blue-1)' }}
                    fw={500}
                    fz="md"
                    py="0.5em"
                  >
                    {t('studies.col_dni')}
                  </Table.Th>
                  <Table.Th
                    w={180}
                    style={{ border: '1px solid var(--mantine-color-blue-1)' }}
                    fw={500}
                    fz="md"
                    py="0.5em"
                  >
                    {t('studies.col_studies')}
                  </Table.Th>
                  <Table.Th
                    w={150}
                    style={{ border: '1px solid var(--mantine-color-blue-1)' }}
                    fw={500}
                    fz="md"
                    py="0.5em"
                  >
                    {t('studies.col_insurance')}
                  </Table.Th>
                  <Table.Th
                    w={150}
                    style={{ border: '1px solid var(--mantine-color-blue-1)', borderRight: 'none' }}
                    fw={500}
                    fz="md"
                    py="0.5em"
                  >
                    {t('studies.col_date')}
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
            )}
            <Table.Tbody>
              {tableRows.length > 0 && tableRows}
              {tableRows.length === 0 && (
                <Table.Tr
                  styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
                  onClick={() => inputRef.current?.focus()}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td colSpan={6}>{emptyState}</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Wrapper>
      ) : (
        <>{studyItems.length > 0 ? mobileCards : emptyState}</>
      )}

      {totalPages > 1 && (
        <Group
          justify="center"
          mt="md"
          pos="sticky"
          bottom="0"
          bg="white"
          py="lg"
          style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}
        >
          <Pagination total={totalPages} value={page} onChange={setPage} size={isDesktop ? 'md' : 'sm'} />
        </Group>
      )}
    </Stack>
  );
}
