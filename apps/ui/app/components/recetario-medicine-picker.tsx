import { useState, useEffect, useCallback } from 'react';
import {
  ActionIcon,
  Text,
  Popover,
  ScrollArea,
  Box,
  Table,
  Loader,
  TextInput,
} from '@mantine/core';
import { useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';

import type { RecetarioMed, RecetarioSelectedMedication } from '~/components/prescribe-utils';

interface RecetarioMedicinePickerProps {
  value: RecetarioSelectedMedication | null;
  onChange: (value: RecetarioSelectedMedication | null) => void;
}

function RecetarioMedicinePicker({ value, onChange }: RecetarioMedicinePickerProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchFetcher = useFetcher<any>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch.length < 3) return;
    searchFetcher.submit(
      { intent: 'search-recetario-medications', data: JSON.stringify({ search: debouncedSearch }) },
      { method: 'post' }
    );
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const results: RecetarioMed[] = searchFetcher.data?.medications || [];
  const isLoading = searchFetcher.state !== 'idle';
  const isUnavailable = searchFetcher.data?.recetarioUnavailable === true;

  const handleSelect = useCallback(
    (med: RecetarioMed) => {
      const packageName = med.packages?.name || '';
      const power = med.packages?.power ? `${med.packages.power.value} ${med.packages.power.unit}` : '';
      const text = [med.drug, packageName, `(${med.brand})`, power ? `- ${power}` : ''].filter(Boolean).join(' ');
      onChange({
        externalId: med.packages?.externalId || '',
        text,
        drug: med.drug,
        brand: med.brand,
        packageName,
        power,
        requiresDuplicate: med.requiresDuplicate,
      });
      setSearch(text);
      setOpened(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setSearch('');
  }, [onChange]);

  const makeFreeTextMedication = useCallback(
    (text: string): RecetarioSelectedMedication => ({
      externalId: '',
      text,
      drug: '',
      brand: '',
      packageName: '',
      power: '',
      requiresDuplicate: false,
    }),
    []
  );

  // Sync search from external value changes (parent reset, repeat data, etc.)
  useEffect(() => {
    if (!opened) {
      setSearch(value?.text ?? '');
    }
  }, [value?.text, opened]);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width="target"
      position="bottom-start"
      offset={4}
      styles={{ dropdown: { padding: 0, minWidth: '500px' } }}
    >
      <Popover.Target>
        <TextInput
          placeholder={t('common.search')}
          value={search}
          onChange={e => {
            const text = e.currentTarget.value;
            setSearch(text);
            if (!opened) setOpened(true);
            onChange(text.trim() ? makeFreeTextMedication(text) : null);
          }}
          onFocus={() => setOpened(true)}
          onBlur={() => setTimeout(() => setOpened(false), 150)}
          rightSection={
            value ? (
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleClear}>
                <MagnifyingGlassIcon size={14} />
              </ActionIcon>
            ) : isLoading ? (
              <Loader size="xs" />
            ) : (
              <MagnifyingGlassIcon size={14} color="gray" />
            )
          }
        />
      </Popover.Target>
      <Popover.Dropdown>
        <ScrollArea.Autosize mah={300}>
          <Box p="xs">
            {isUnavailable && (
              <Text size="sm" c="red" ta="center" py="sm">
                {t('recetario.service_unavailable')}
              </Text>
            )}
            {!isUnavailable && results.length === 0 && !isLoading && (
              <Text size="sm" c="dimmed" ta="center" py="sm">
                {debouncedSearch ? t('common.no_results') : t('forms.type_to_search_medications')}
              </Text>
            )}
            {results.length > 0 && (
              <Table variant="simple" verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('forms.medication_commercial_name')}</Table.Th>
                    <Table.Th>{t('forms.medication_generic_drug')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {results.map(med => (
                    <Table.Tr
                      key={med.id}
                      style={{ cursor: 'pointer' }}
                      onMouseDown={e => {
                        e.preventDefault();
                        handleSelect(med);
                      }}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {med.brand}
                        </Text>
                        {med.packages?.name && (
                          <Text size="xs" c="dimmed">
                            {med.packages.name}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{med.drug}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Box>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

export { RecetarioMedicinePicker };
export type { RecetarioMedicinePickerProps };
