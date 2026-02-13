import { useTranslation } from 'react-i18next';
import { useNavigate } from '@remix-run/react';
import { Search, FlaskConical } from 'lucide-react';
import dayjs from 'dayjs';
import { Table, Text as BaseText, Pagination, Group, Badge } from '@mantine/core';

import { styled } from '~/styled-system/jsx';
import { displayDocumentValue } from '~/utils';

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

export interface Study {
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

export interface StudyItem {
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
    boxShadow: '0 0 0 1px var(--mantine-color-gray-2)',
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
    gap: '0.5rem',
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toStudyItems(studies: Study[]): StudyItem[] {
  return studies.map(study => {
    const patient = study.patient;
    const firstName = patient?.personalData?.firstName || '';
    const lastName = patient?.personalData?.lastName || '';
    const dni = patient?.personalData?.documentValue;
    const medicare = patient?.medicare || '';
    const hasResults = (study.results ?? []).length > 0;

    return { study, firstName, lastName, dni, medicare, hasResults };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StudiesTableProps {
  items: StudyItem[];
  isDesktop: boolean;
  isLoading: boolean;
  searchValue: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEmptyClick?: () => void;
}

export function StudiesTable({
  items,
  isDesktop,
  isLoading,
  searchValue,
  page,
  totalPages,
  onPageChange,
  onEmptyClick,
}: StudiesTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // -------------------------------------------------------------------------
  // Shared: study type badges
  // -------------------------------------------------------------------------

  const renderBadges = (types: string[]) => (
    <Group gap={4} wrap="wrap">
      {types.map(type => {
        const badge = STUDY_TYPE_BADGES[type];
        if (!badge) return null;
        return (
          <Badge key={type} size="xs" color={badge.color} variant="filled">
            {badge.short}
          </Badge>
        );
      })}
    </Group>
  );

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  const emptyState = (
    <EmptyState onClick={onEmptyClick} style={{ cursor: 'pointer' }}>
      {searchValue && !isLoading ? (
        <FlaskConical size={48} color="var(--mantine-color-dimmed)" />
      ) : (
        <Search size={48} color="var(--mantine-color-dimmed)" />
      )}
      <BaseText c="dimmed" ta="center">
        {searchValue && !isLoading ? t('studies.no_results') : t('studies.search_prompt')}
      </BaseText>
    </EmptyState>
  );

  // -------------------------------------------------------------------------
  // Desktop table rows
  // -------------------------------------------------------------------------

  const tableRows = items.map(item => (
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
      <Table.Td>{renderBadges(item.study.studies)}</Table.Td>
      <Table.Td>
        <CellText>{item.medicare}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{item.study.date ? dayjs(item.study.date).format('DD/MM/YYYY') : '—'}</CellText>
      </Table.Td>
    </Table.Tr>
  ));

  // -------------------------------------------------------------------------
  // Mobile cards
  // -------------------------------------------------------------------------

  const mobileCards = items.map(item => (
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
        {renderBadges(item.study.studies)}
        {item.medicare && (
          <BaseText size="xs" c="dimmed">
            {item.medicare}
          </BaseText>
        )}
      </CardRow>
    </Card>
  ));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <HeaderContainer>
        <Title>{t('studies.title')}</Title>
      </HeaderContainer>

      {isDesktop && (
        <Wrapper>
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
                  onClick={onEmptyClick}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td colSpan={6}>{emptyState}</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Wrapper>
      )}

      {!isDesktop && <>{items.length > 0 ? mobileCards : emptyState}</>}

      {totalPages > 1 && (
        <Group
          justify="center"
          pos="sticky"
          bottom="0"
          bg="white"
          py="lg"
          style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}
        >
          <Pagination total={totalPages} value={page} onChange={onPageChange} size={isDesktop ? 'md' : 'sm'} />
        </Group>
      )}
    </>
  );
}
