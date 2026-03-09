import { useState, useMemo, useCallback, useRef, type FC } from 'react';
import { useNavigate } from '@remix-run/react';
import { Autocomplete, Loader, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

import { useFind } from '~/components/provider';
import type { Patient } from '~/declarations';
import { displayDocumentValue } from '~/utils';
import { getMedicareLabel } from '~/components/medicare-display';
import { trackAction } from '~/utils/breadcrumbs';

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
  variant?: 'unstyled' | 'filled' | 'default';
}

const CREATE_NEW_VALUE = '__create_new__';

const PatientSearch: FC<PatientSearchProps> = ({
  onChange,
  onBlur,
  placeholder,
  autoFocus = false,
  createNewPatientSlot,
  variant = 'unstyled',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolvedPlaceholder = placeholder ?? t('patients.search_patient');
  const [inputValue, setInputValue] = useState('');
  const [debouncedInputValue] = useDebouncedValue(inputValue, 500);
  const [selected, setSelected] = useState(false);
  const ignoreNextChange = useRef(false);

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

  const { autocompleteData, patientByValue } = useMemo(() => {
    const map = new Map<string, Patient>();
    const seen = new Set<string>();
    const data: string[] = [];

    for (const patient of patients as Patient[]) {
      const name = `${patient.personalData.firstName} ${patient.personalData.lastName}`.trim();
      const doc = displayDocumentValue(patient.personalData.documentValue);
      let display = doc !== '—' ? `${name} — ${doc}` : name;

      if (seen.has(display)) {
        display = `${display} (${patient.id.slice(0, 6)})`;
      }

      seen.add(display);
      map.set(display, patient);
      data.push(display);
    }

    const showCreateNew = createNewPatientSlot && (inputValue === '' || patients.length === 0);
    if (showCreateNew) {
      data.push(CREATE_NEW_VALUE);
    }

    return { autocompleteData: data, patientByValue: map };
  }, [patients, inputValue, createNewPatientSlot]);

  const handleChange = useCallback(
    (value: string) => {
      if (ignoreNextChange.current) {
        ignoreNextChange.current = false;
        return;
      }
      setInputValue(value);
      if (selected) setSelected(false);
    },
    [selected]
  );

  const handleOptionSubmit = useCallback(
    (value: string) => {
      if (value === CREATE_NEW_VALUE && createNewPatientSlot) {
        navigate('/patients/new', {
          state: {
            assignSlot: createNewPatientSlot,
            returnTo: `/appointments/${createNewPatientSlot.medicId}/${createNewPatientSlot.startDate.slice(0, 10)}`,
          },
        });
        return;
      }

      const patient = patientByValue.get(value);
      if (patient) {
        trackAction('Selected patient from search', { patientId: patient.id });
        onChange?.(patient.id);
        const name = `${patient.personalData.firstName} ${patient.personalData.lastName}`.trim();
        setInputValue(name);
        setSelected(true);
        ignoreNextChange.current = true;
      }
    },
    [patientByValue, onChange, createNewPatientSlot, navigate]
  );

  const handleBlur = useCallback(() => {
    if (inputValue === '') onBlur?.();
  }, [inputValue, onBlur]);

  const renderOption = useCallback(
    ({ option }: { option: { value: string } }) => {
      if (option.value === CREATE_NEW_VALUE) {
        return (
          <Text size="sm" c="var(--mantine-primary-color-4)">
            {t('patients.new_patient')}
          </Text>
        );
      }
      const patient = patientByValue.get(option.value);
      if (!patient) return option.value;

      return (
        <div>
          <Text size="sm">
            {patient.personalData.firstName} {patient.personalData.lastName}
            {displayDocumentValue(patient.personalData.documentValue) !== '—' &&
              ` (${patient.personalData.documentValue})`}
          </Text>
          <Text size="xs" c="dimmed">
            {getMedicareLabel(patient) || t('overview.private')} {patient.medicareNumber}
          </Text>
        </div>
      );
    },
    [patientByValue, t]
  );

  return (
    <Autocomplete
      value={inputValue}
      onChange={handleChange}
      onOptionSubmit={handleOptionSubmit}
      onBlur={handleBlur}
      data={selected ? [] : autocompleteData}
      filter={({ options }) => options}
      placeholder={resolvedPlaceholder}
      autoFocus={autoFocus}
      leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
      maxDropdownHeight={300}
      renderOption={renderOption}
      variant={variant}
      styles={{ input: { fontSize: '1em' } }}
      autoComplete="off"
      data-1p-ignore
    />
  );
};

export default PatientSearch;
