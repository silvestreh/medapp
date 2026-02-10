import { useState, useMemo, type FC } from 'react';
import { Popover, TextInput, Stack, Loader, Text } from '@mantine/core';
import { useDebouncedValue, useDisclosure, useClickOutside } from '@mantine/hooks';
import { Search } from 'lucide-react';

import { useFind } from '~/components/provider';
import { styled } from '~/stitches';
import type { Patient } from '~/declarations';
import { displayDocumentValue } from '~/utils';

interface PatientSearchProps {
  onChange?: (patientId: Patient['id']) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const Button = styled('button', {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  alignItems: 'flex-start',
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  padding: '0.5em 1em',
  borderRadius: 'var(--mantine-radius-sm)',

  '&:hover': {
    backgroundColor: 'var(--mantine-color-blue-0)',
  },
});

const PatientSearch: FC<PatientSearchProps> = ({
  onChange,
  onBlur,
  placeholder = 'Buscar paciente…',
  autoFocus = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const [isOpen, { open, close }] = useDisclosure(false);
  const ref = useClickOutside(() => close());
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

  const handleBlur = () => {
    if (inputValue === '') onBlur?.();
  };

  const handleFocus = () => {
    if (patients.length > 0) open();
  };

  return (
    <Popover
      withArrow
      arrowSize={12}
      position="bottom-start"
      styles={{ dropdown: { padding: 4 } }}
      key={patients.length}
      opened={isOpen && patients.length > 0}
      shadow="xs"
    >
      <Popover.Target>
        <TextInput
          variant="unstyled"
          autoFocus={autoFocus}
          onFocus={handleFocus}
          onClick={open}
          value={inputValue}
          onChange={e => setInputValue(e.currentTarget.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          styles={{ input: { fontSize: '1em' } }}
          leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
        />
      </Popover.Target>
      <Popover.Dropdown ref={ref}>
        <Stack gap={4}>
          {patients.map((patient: Patient) => (
            <Button key={patient.id} onClick={() => onChange?.(patient.id)}>
              <Text>
                {patient.personalData.firstName} {patient.personalData.lastName}
                {displayDocumentValue(patient.personalData.documentValue) !== '—' && ` (${patient.personalData.documentValue})`}
              </Text>
              <Text size="xs" c="dimmed">
                {patient.medicare} {patient.medicareNumber}
              </Text>
            </Button>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

export default PatientSearch;
