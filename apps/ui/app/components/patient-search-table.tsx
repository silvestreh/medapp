import { useState, useMemo, type FC, useEffect, useRef } from 'react';
import { Table, TextInput, Stack, Loader, Text as BaseText } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { Search } from 'lucide-react';
import { useNavigate, useSearchParams } from '@remix-run/react';

import { useFind } from '~/components/provider';
import type { Patient } from '~/declarations';
import Portal from '~/components/portal';
import { styled } from '~/stitches';

const Wrapper = styled('div', {
  background: 'White',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--mantine-color-gray-2)',
  width: '100%',

  variants: {
    borderRadius: {
      true: {
        borderRadius: 'var(--mantine-radius-md)',
        borderWidth: 1,
      },
      false: {
        borderWidth: 0,
      },
    },
    hideOnMobileIfEmpty: {
      true: {
        '@sm': {
          display: 'none',
        },
        '@lg': {
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
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  display: 'block',
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
    if (debouncedInputValue) {
      newParams.set('q', debouncedInputValue);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true, preventScrollReset: true });
  }, [debouncedInputValue, setSearchParams, searchParams]);

  const query = useMemo(
    () => ({
      firstName: debouncedInputValue,
      lastName: debouncedInputValue,
      documentValue: debouncedInputValue,
    }),
    [debouncedInputValue]
  );

  const {
    response: { data: patients = [] },
    isLoading,
  } = useFind('patients', query);

  const rows = patients.map((patient: Patient) => (
    <Table.Tr key={patient.id} onClick={() => navigate(`/encounters/${patient.id}`)} style={{ cursor: 'pointer' }}>
      <Table.Td>
        <Text>{patient.personalData.firstName || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text>{patient.personalData.lastName || '—'}</Text>
      </Table.Td>
      <Table.Td>
        <Text>{patient.personalData.documentValue || '—'}</Text>
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
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre</Table.Th>
              <Table.Th>Apellido</Table.Th>
              <Table.Th>Documento</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length > 0 && rows}
            {rows.length === 0 && (
              <Table.Tr onClick={() => inputRef.current?.focus()} style={{ cursor: 'pointer' }}>
                <Table.Td colSpan={3}>
                  <BaseText c="dimmed">
                    {inputValue && !isLoading ? 'No se encontraron pacientes' : 'Comience a escribir para buscar...'}
                  </BaseText>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Wrapper>
    </Stack>
  );
};

export default PatientSearchTable;
