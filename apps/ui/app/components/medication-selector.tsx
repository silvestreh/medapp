import { useState, useEffect } from 'react';
import {
  TextInput,
  Popover,
  ScrollArea,
  Box,
  Text as MantineText,
  Flex,
  Loader,
  ActionIcon,
  Group,
  Table,
} from '@mantine/core';
import { Search, X, Check } from 'lucide-react';

import { useFind } from '~/components/provider';
import { useTranslation } from 'react-i18next';
import { styled } from '~/styled-system/jsx';

const StyledInput = styled('input', {
  base: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    flex: 1,
    minWidth: '60px',
    fontSize: 'var(--mantine-font-size-sm)',
    fontFamily: 'inherit',
    cursor: 'text',
  },

  variants: {
    readOnly: {
      true: {
        cursor: 'default',
      },
    },
  },
});

const TableRow = styled('tr', {
  base: {
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    '&:hover': {
      backgroundColor: 'var(--mantine-color-gray-0)',
    },
  },
  variants: {
    selected: {
      true: {
        backgroundColor: 'var(--mantine-color-blue-0)',
      },
    },
  },
});

interface Medication {
  id: string;
  commercialNamePresentation: string;
  genericDrug: string;
  pharmaceuticalForm: string;
}

interface MedicationSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  readOnly?: boolean;
}

export function MedicationSelector({ value, onChange, placeholder, label, error, readOnly }: MedicationSelectorProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Sync searchValue with value when popover opens
  useEffect(() => {
    if (opened) {
      setSearchValue(value || '');
    }
  }, [opened, value]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Use useFind for searching medications
  const { response, isLoading: loading } = useFind(
    'medications',
    {
      $search: debouncedSearch,
      $limit: 20,
    },
    { enabled: opened && !!debouncedSearch }
  );

  const results = (response as any)?.data || [];

  const handleSelect = (medication: Medication) => {
    const formattedValue = `${medication.commercialNamePresentation} / ${medication.genericDrug} / ${medication.pharmaceuticalForm}`;
    onChange(formattedValue);
    setSearchValue(formattedValue);
    setOpened(false);
  };

  const handleCustomSubmit = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim());
      setOpened(false);
    }
  };

  return (
    <Flex direction="column" flex={1}>
      <Popover
        opened={opened && !readOnly}
        onChange={setOpened}
        width="target"
        position="bottom-start"
        offset={0}
        styles={{ dropdown: { padding: 0, minWidth: '600px' } }}
        disabled={readOnly}
      >
        <Popover.Target>
          <TextInput
            label={label}
            placeholder={!value ? placeholder || t('common.search') : ''}
            component="div"
            variant="unstyled"
            styles={{
              input: {
                minHeight: '1.5rem',
                height: 'auto',
                lineHeight: 1.75,
                cursor: readOnly ? 'default' : 'text',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                alignItems: 'center',
                padding: '0',
              },
            }}
            onClick={() => !readOnly && setOpened(true)}
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : 0}
            error={error}
            rightSection={
              loading ? (
                <Loader size="xs" />
              ) : value && !readOnly ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={e => {
                    e.stopPropagation();
                    onChange('');
                    setSearchValue('');
                  }}
                  style={{ pointerEvents: 'all' }}
                >
                  <X size={16} />
                </ActionIcon>
              ) : !readOnly ? (
                <Search size={16} color="gray" />
              ) : null
            }
            rightSectionPointerEvents={loading || (value && !readOnly) ? 'all' : 'none'}
          >
            <Group gap={4} style={{ flex: 1 }}>
              {!opened && value ? (
                <MantineText size="sm" style={{ flex: 1 }}>
                  {value}
                </MantineText>
              ) : null}
              {!readOnly && (opened || !value) ? (
                <StyledInput
                  value={searchValue}
                  onChange={e => {
                    if (readOnly) return;
                    setSearchValue(e.currentTarget.value);
                    if (!opened) setOpened(true);
                  }}
                  onFocus={() => !readOnly && setOpened(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleCustomSubmit();
                    }
                  }}
                  onBlur={() => {
                    if (searchValue.trim() && searchValue !== value) {
                      handleCustomSubmit();
                    }
                  }}
                  placeholder={!value || opened ? placeholder || t('common.search') : ''}
                  readOnly={readOnly}
                />
              ) : null}
            </Group>
          </TextInput>
        </Popover.Target>
        {!readOnly && (
          <Popover.Dropdown>
            <ScrollArea.Autosize mah={400} type="auto">
              <Box p="xs">
                {results.length === 0 && !loading && (
                  <MantineText size="sm" c="dimmed" ta="center" py="xl">
                    {searchValue ? t('common.no_results') : t('forms.type_to_search_medications')}
                  </MantineText>
                )}
                {results.length > 0 && (
                  <Table variant="simple" verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('forms.medication_commercial_name')}</Table.Th>
                        <Table.Th>{t('forms.medication_generic_drug')}</Table.Th>
                        <Table.Th>{t('forms.medication_pharmaceutical_form')}</Table.Th>
                        <Table.Th style={{ width: 40 }}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {results.map((med: Medication) => {
                        const formattedMed = `${med.commercialNamePresentation} / ${med.genericDrug} / ${med.pharmaceuticalForm}`;
                        return (
                          <TableRow
                            key={med.id}
                            onMouseDown={e => {
                              e.preventDefault();
                              handleSelect(med);
                            }}
                            selected={value === formattedMed}
                          >
                            <Table.Td>
                              <MantineText size="sm" fw={500}>
                                {med.commercialNamePresentation}
                              </MantineText>
                            </Table.Td>
                            <Table.Td>
                              <MantineText size="sm">{med.genericDrug}</MantineText>
                            </Table.Td>
                            <Table.Td>
                              <MantineText size="sm">{med.pharmaceuticalForm}</MantineText>
                            </Table.Td>
                            <Table.Td>
                              {value === formattedMed && <Check size={14} color="var(--mantine-color-blue-6)" />}
                            </Table.Td>
                          </TableRow>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </Box>
            </ScrollArea.Autosize>
          </Popover.Dropdown>
        )}
      </Popover>
    </Flex>
  );
}
