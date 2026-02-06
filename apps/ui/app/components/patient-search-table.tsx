import { useState, useMemo, type FC, useEffect } from 'react';
import { Table, TextInput, Stack, Loader, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { Search } from 'lucide-react';
import { useNavigate, useSearchParams } from '@remix-run/react';

import { useFind } from '~/components/provider';
import type { Patient } from '~/declarations';

const PatientSearchTable: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialSearch);
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const navigate = useNavigate();

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (debouncedInputValue) {
      newParams.set('q', debouncedInputValue);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true, preventScrollReset: true });
  }, [debouncedInputValue, setSearchParams]);

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
      <Table.Td>{patient.id}</Table.Td>
      <Table.Td>{patient.personalData.firstName}</Table.Td>
      <Table.Td>{patient.personalData.lastName}</Table.Td>
      <Table.Td>{patient.personalData.documentValue || '-'}</Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <TextInput
        placeholder="Buscar paciente por nombre, apellido o documento..."
        value={inputValue}
        onChange={event => setInputValue(event.currentTarget.value)}
        leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
        size="lg"
      />

      <Table highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>id</Table.Th>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Apellido</Table.Th>
            <Table.Th>Documento</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text c="dimmed" py="xl">
                  {inputValue && !isLoading ? 'No se encontraron pacientes' : 'Comience a escribir para buscar...'}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
};

export default PatientSearchTable;
