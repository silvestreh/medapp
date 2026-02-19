import { useState, useMemo, type FC } from 'react';
import { Link } from '@remix-run/react';
import { Popover, TextInput, Stack, Loader, Text } from '@mantine/core';
import { useDebouncedValue, useDisclosure, useClickOutside } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { useFind } from '~/components/provider';
import { styled } from '~/styled-system/jsx';
import type { Patient } from '~/declarations';
import { displayDocumentValue } from '~/utils';

export interface CreateNewPatientSlot {
  medicId: string;
  startDate: string;
  extra: boolean;
}

interface PatientSearchProps {
  onChange?: (patientId: Patient['id']) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  createNewPatientSlot?: CreateNewPatientSlot | null;
}

const Button = styled('button', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    alignItems: 'flex-start',
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    padding: '0.5em 1em',
    borderRadius: 'var(--mantine-radius-sm)',

    '&:hover': {
      backgroundColor: 'var(--mantine-color-blue-0)',
    },
  },
});

const CreateNewLink = styled(Link, {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    alignItems: 'flex-start',
    padding: '0.5em 1em',
    borderRadius: 'var(--mantine-radius-sm)',
    color: 'inherit',
    textDecoration: 'none',

    '&:hover': {
      backgroundColor: 'var(--mantine-color-blue-0)',
    },
  },
});

const PatientSearch: FC<PatientSearchProps> = ({
  onChange,
  onBlur,
  placeholder,
  autoFocus = false,
  createNewPatientSlot,
}) => {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t('patients.search_patient');
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

  const showCreateNew =
    createNewPatientSlot && (inputValue === '' || patients.length === 0);
  const dropdownOpen =
    isOpen &&
    (patients.length > 0 || (createNewPatientSlot && (inputValue === '' || patients.length === 0)));

  const handleBlur = () => {
    if (inputValue === '') onBlur?.();
  };

  const handleFocus = () => {
    if (patients.length > 0 || createNewPatientSlot) open();
  };

  const handleSelectPatient = (patient: Patient) => {
    onChange?.(patient.id);
    setInputValue(`${patient.personalData.firstName} ${patient.personalData.lastName}`.trim());
    close();
  };

  const createNewState = createNewPatientSlot
    ? {
        assignSlot: createNewPatientSlot,
        returnTo: `/appointments/${createNewPatientSlot.medicId}/${createNewPatientSlot.startDate.slice(0, 10)}`,
      }
    : undefined;

  return (
    <Popover
      withArrow
      arrowSize={12}
      position="bottom-start"
      styles={{ dropdown: { padding: 4 } }}
      key={patients.length}
      opened={dropdownOpen}
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
          placeholder={resolvedPlaceholder}
          styles={{ input: { fontSize: '1em' } }}
          leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
          autoComplete="off"
          data-1p-ignore
        />
      </Popover.Target>
      <Popover.Dropdown ref={ref}>
        <Stack gap={4}>
          {patients.map((patient: Patient) => (
            <Button
              key={patient.id}
              onMouseDown={e => {
                e.preventDefault();
                handleSelectPatient(patient);
              }}
            >
              <Text>
                {patient.personalData.firstName} {patient.personalData.lastName}
                {displayDocumentValue(patient.personalData.documentValue) !== '—' &&
                  ` (${patient.personalData.documentValue})`}
              </Text>
              <Text size="xs" c="dimmed">
                {patient.medicare} {patient.medicareNumber}
              </Text>
            </Button>
          ))}
          {showCreateNew && createNewState && (
            <CreateNewLink
              to="/patients/new"
              state={createNewState}
              onMouseDown={e => e.preventDefault()}
            >
              <Text>{t('patients.new_patient')}</Text>
            </CreateNewLink>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

export default PatientSearch;
