import { useState, useMemo, type FC, useEffect, useRef } from 'react';
import { Table, TextInput, Stack, Loader, Text as BaseText, Pagination, Group } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { Search, User } from 'lucide-react';
import { useNavigate, useSearchParams } from '@remix-run/react';

import { useFind } from '~/components/provider';
import type { Patient } from '~/declarations';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { displayDocumentValue } from '~/utils';

const Wrapper = styled('div', {
  base: {
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--mantine-color-gray-2)',
    width: '100%',
  },

  variants: {
    borderRadius: {
      true: {
        borderRadius: 'var(--mantine-radius-md)',
        borderWidth: '1px',
      },
      false: {
        borderWidth: 0,
      },
    },
    hideOnMobileIfEmpty: {
      true: {
        sm: {
          display: 'none',
        },
        lg: {
          display: 'flex',
        },
      },
    },
  },

  defaultVariants: {
    borderRadius: true,
  },
});

const Text = styled(BaseText, {
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

const PatientSearchTable: FC = () => {
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
      // Reset page when search changes
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

  const query = useMemo(
    () => ({
      q: debouncedInputValue,
      $limit: 10,
      $skip: (page - 1) * 10,
    }),
    [debouncedInputValue, page]
  );

  const { response, isLoading } = useFind('patients', query);

  const patients = (response as any).data || [];
  const total = (response as any).total || 0;
  const totalPages = Math.ceil(total / 10);

  const rows = patients.map((patient: Patient) => (
    <Table.Tr key={patient.id} onClick={() => navigate(`/encounters/${patient.id}`)} style={{ cursor: 'pointer' }}>
      <Table.Td>
        <Text>{patient.personalData.firstName || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text>{patient.personalData.lastName || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text>{displayDocumentValue(patient.personalData.documentValue)}</Text>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack>
      <Portal id="toolbar">
        <TextInput
          ref={inputRef}
          autoFocus
          placeholder="Buscar paciente por nombre, apellido o documento..."
          value={inputValue}
          onChange={event => setInputValue(event.currentTarget.value)}
          leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
          size="lg"
          w="100%"
        />
      </Portal>

      <Wrapper hideOnMobileIfEmpty={rows.length === 0}>
        <Table highlightOnHover layout="fixed" variant="vertical">
          {rows.length > 0 && (
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Apellido</Table.Th>
                <Table.Th>Documento</Table.Th>
              </Table.Tr>
            </Table.Thead>
          )}
          <Table.Tbody>
            {rows.length > 0 && rows}
            {rows.length === 0 && (
              <Table.Tr onClick={() => inputRef.current?.focus()} style={{ cursor: 'pointer' }}>
                <Table.Td colSpan={3}>
                  <EmptyState>
                    {inputValue && !isLoading ? (
                      <User size={48} color="var(--mantine-color-dimmed)" />
                    ) : (
                      <Search size={48} color="var(--mantine-color-dimmed)" />
                    )}
                    <BaseText c="dimmed" ta="center">
                      {inputValue && !isLoading ? 'No se encontraron pacientes' : 'Comience a escribir para buscar...'}
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
};

export default PatientSearchTable;
