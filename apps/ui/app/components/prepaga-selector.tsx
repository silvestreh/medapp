import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Stack,
  Table,
} from '@mantine/core';
import { Search, X, Check } from 'lucide-react';

import { useFind, useGet } from '~/components/provider';
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

interface Prepaga {
  id: string;
  shortName: string;
  denomination: string;
}

interface PrepagaSelectorProps {
  /** Prepaga UUID */
  value?: string;
  /** Called with the selected prepaga ID (or empty string on clear) */
  onChange: (id: string) => void;
  onSelectPrepaga?: (prepaga: Prepaga) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  readOnly?: boolean;
}

export function PrepagaSelector({
  value,
  onChange,
  onSelectPrepaga,
  placeholder,
  label,
  error,
  readOnly,
}: PrepagaSelectorProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data: selectedPrepaga } = useGet('prepagas', value!, {
    enabled: !!value,
  });

  const displayLabel = useMemo(() => {
    if (!selectedPrepaga) return '';
    const p = selectedPrepaga as Prepaga;
    if (!p.shortName && !p.denomination) return '';
    return `${p.shortName || ''} / ${p.denomination || ''}`;
  }, [selectedPrepaga]);

  useEffect(() => {
    if (opened) {
      setSearchValue('');
    }
  }, [opened]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const { response, isLoading: loading } = useFind(
    'prepagas',
    {
      $search: debouncedSearch,
      $limit: 20,
    },
    { enabled: opened && !!debouncedSearch },
  );

  const results = (response as any)?.data || [];

  const handleSelect = useCallback(
    (prepaga: Prepaga) => {
      onChange(prepaga.id);
      onSelectPrepaga?.(prepaga);
      setOpened(false);
    },
    [onChange, onSelectPrepaga],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setSearchValue('');
    },
    [onChange],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly) return;
      setSearchValue(e.currentTarget.value);
      if (!opened) setOpened(true);
    },
    [readOnly, opened],
  );

  const handleFocus = useCallback(() => {
    if (!readOnly) setOpened(true);
  }, [readOnly]);

  const handleClick = useCallback(() => {
    if (!readOnly) setOpened(true);
  }, [readOnly]);

  if (readOnly) {
    return (
      <Flex direction="column" flex={1}>
        {selectedPrepaga ? (
          <Stack gap={0}>
            <MantineText size="sm">{(selectedPrepaga as Prepaga).shortName}</MantineText>
            <MantineText size="xs" c="dimmed">
              {(selectedPrepaga as Prepaga).denomination}
            </MantineText>
          </Stack>
        ) : (
          <MantineText size="sm" c="dimmed">
            —
          </MantineText>
        )}
      </Flex>
    );
  }

  return (
    <Flex direction="column" flex={1}>
      <Popover
        opened={opened}
        onChange={setOpened}
        width="target"
        position="bottom-start"
        offset={0}
        styles={{ dropdown: { padding: 0, minWidth: '500px' } }}
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
                cursor: 'text',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                alignItems: 'center',
                padding: '0',
              },
            }}
            onClick={handleClick}
            tabIndex={0}
            error={error}
            rightSection={
              loading ? (
                <Loader size="xs" />
              ) : value ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  onClick={handleClear}
                  style={{ pointerEvents: 'all' }}
                >
                  <X size={16} />
                </ActionIcon>
              ) : (
                <Search size={16} color="gray" />
              )
            }
            rightSectionPointerEvents={loading || value ? 'all' : 'none'}
          >
            <Group gap={4} style={{ flex: 1 }}>
              {!opened && displayLabel && (
                <MantineText size="sm" style={{ flex: 1 }}>
                  {displayLabel}
                </MantineText>
              )}
              {(opened || !value) && (
                <StyledInput
                  value={searchValue}
                  onChange={handleSearchChange}
                  onFocus={handleFocus}
                  placeholder={
                    !value || opened
                      ? placeholder || t('forms.type_to_search_prepagas')
                      : ''
                  }
                />
              )}
            </Group>
          </TextInput>
        </Popover.Target>
        <Popover.Dropdown>
          <ScrollArea.Autosize mah={400} type="auto">
            <Box p="xs">
              {results.length === 0 && !loading && (
                <MantineText size="sm" c="dimmed" ta="center" py="xl">
                  {searchValue
                    ? t('common.no_results')
                    : t('forms.type_to_search_prepagas')}
                </MantineText>
              )}
              {results.length > 0 && (
                <Table variant="simple" verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('forms.prepaga_short_name')}</Table.Th>
                      <Table.Th>{t('forms.prepaga_denomination')}</Table.Th>
                      <Table.Th style={{ width: 40 }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {results.map((prepaga: Prepaga) => (
                      <TableRow
                        key={prepaga.id}
                        onMouseDown={e => {
                          e.preventDefault();
                          handleSelect(prepaga);
                        }}
                        selected={value === prepaga.id}
                      >
                        <Table.Td>
                          <MantineText size="sm" fw={500}>
                            {prepaga.shortName}
                          </MantineText>
                        </Table.Td>
                        <Table.Td>
                          <MantineText size="sm">
                            {prepaga.denomination}
                          </MantineText>
                        </Table.Td>
                        <Table.Td>
                          {value === prepaga.id && (
                            <Check
                              size={14}
                              color="var(--mantine-color-blue-6)"
                            />
                          )}
                        </Table.Td>
                      </TableRow>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Box>
          </ScrollArea.Autosize>
        </Popover.Dropdown>
      </Popover>
    </Flex>
  );
}
