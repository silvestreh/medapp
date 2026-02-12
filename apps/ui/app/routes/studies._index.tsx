import { useState, useMemo, useEffect, useRef } from 'react';
import { Table, TextInput, Stack, Loader, Text as BaseText, Pagination, Group, Badge, Button } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { Search, FlaskConical, Plus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from '@remix-run/react';
import dayjs from 'dayjs';

import { useFind } from '~/components/provider';
import { authenticatedLoader } from '~/utils/auth.server';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { displayDocumentValue } from '~/utils';

export const loader = authenticatedLoader();

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
  base: {
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--mantine-color-gray-2)',
    width: '100%',
    borderRadius: 'var(--mantine-radius-md)',
  },
});

const CellText = styled(BaseText, {
  base: {
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    display: 'block',
    padding: 'var(--mantine-spacing-xs)',
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

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudiesIndex() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialSearch);
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

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
  // Search: protocol (numeric) vs patient (text)
  // -------------------------------------------------------------------------

  const isNumericSearch = /^\d+$/.test(debouncedInputValue);
  const hasSearch = debouncedInputValue.length > 0;
  const isPatientSearch = hasSearch && !isNumericSearch && debouncedInputValue.length >= 2;

  // Step 1: search patients when input is text
  const patientQuery = useMemo(
    () => ({
      q: debouncedInputValue,
      $limit: 50,
    }),
    [debouncedInputValue]
  );

  const { response: patientResponse, isLoading: patientsLoading } = useFind(
    'patients',
    patientQuery,
    { enabled: isPatientSearch }
  );

  const patientIds: string[] = useMemo(() => {
    if (!isPatientSearch) return [];
    const data = (patientResponse as any)?.data || [];
    return data.map((p: any) => p.id);
  }, [isPatientSearch, patientResponse]);

  // Step 2: build studies query based on search type
  const studiesQuery = useMemo(() => {
    const base: Record<string, any> = {
      $sort: { createdAt: -1 },
      $limit: PAGE_SIZE,
      $skip: (page - 1) * PAGE_SIZE,
    };

    if (!hasSearch) return base;

    if (isNumericSearch) {
      return { ...base, protocol: parseInt(debouncedInputValue, 10) };
    }

    // Patient search: use matched IDs or sentinel to get empty results
    if (patientIds.length > 0) {
      return { ...base, patientId: { $in: patientIds } };
    }

    // Still loading patients or no matches — use impossible filter
    return { ...base, patientId: 'none' };
  }, [hasSearch, isNumericSearch, debouncedInputValue, page, patientIds]);

  // Don't query studies while patient search is still loading
  const studiesEnabled = !isPatientSearch || !patientsLoading;

  const { response, isLoading: studiesLoading } = useFind('studies', studiesQuery, {
    enabled: studiesEnabled,
  });

  const isLoading = patientsLoading || studiesLoading;
  const studies = (response as any).data || [];
  const total = (response as any).total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const rows = studies.map((study: any) => {
    const patient = study.patient;
    const firstName = patient?.personalData?.firstName || '';
    const lastName = patient?.personalData?.lastName || '';
    const dni = patient?.personalData?.documentValue;
    const medicare = patient?.medicare || '';
    const hasResults = study.results && study.results.length > 0;

    return (
      <Table.Tr
        key={study.id}
        onClick={() => navigate(`/studies/${study.id}`)}
        style={{
          cursor: 'pointer',
          opacity: study.noOrder ? 0.7 : 1,
          backgroundColor: !hasResults ? 'var(--mantine-color-yellow-0)' : undefined,
        }}
      >
        <Table.Td>
          <CellText fw={600} size="sm">#{study.protocol}</CellText>
        </Table.Td>
        <Table.Td>
          <CellText size="sm">{firstName} {lastName}</CellText>
        </Table.Td>
        <Table.Td>
          <CellText size="sm">{displayDocumentValue(dni)}</CellText>
        </Table.Td>
        <Table.Td>
          <Group gap={4} wrap="wrap">
            {(study.studies || []).map((type: string) => {
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
          <CellText size="sm">{medicare}</CellText>
        </Table.Td>
        <Table.Td>
          <CellText size="sm">{study.date ? dayjs(study.date).format('DD/MM/YYYY') : '—'}</CellText>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Stack p="lg">
      <Portal id="toolbar">
        <Group justify="space-between" align="center" w="100%">
          <TextInput
            ref={inputRef}
            autoFocus
            placeholder="Buscar por protocolo o paciente..."
            value={inputValue}
            onChange={event => setInputValue(event.currentTarget.value)}
            leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
            size="lg"
            style={{ flex: 1 }}
          />
          <Button component={Link} to="/studies/new" leftSection={<Plus size={16} />}>
            Nuevo Estudio
          </Button>
        </Group>
      </Portal>

      <Wrapper>
        <Table highlightOnHover layout="fixed">
          {rows.length > 0 && (
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={100}>Protocolo</Table.Th>
                <Table.Th>Paciente</Table.Th>
                <Table.Th w={120}>DNI</Table.Th>
                <Table.Th w={180}>Estudios</Table.Th>
                <Table.Th w={140}>Obra Social</Table.Th>
                <Table.Th w={110}>Fecha</Table.Th>
              </Table.Tr>
            </Table.Thead>
          )}
          <Table.Tbody>
            {rows.length > 0 && rows}
            {rows.length === 0 && (
              <Table.Tr onClick={() => inputRef.current?.focus()} style={{ cursor: 'pointer' }}>
                <Table.Td colSpan={6}>
                  <EmptyState>
                    {inputValue && !isLoading ? (
                      <FlaskConical size={48} color="var(--mantine-color-dimmed)" />
                    ) : (
                      <Search size={48} color="var(--mantine-color-dimmed)" />
                    )}
                    <BaseText c="dimmed" ta="center">
                      {inputValue && !isLoading ? 'No se encontraron estudios' : 'Buscar estudios...'}
                    </BaseText>
                  </EmptyState>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Wrapper>

      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}
