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

interface Prepaga {
  id: string;
  shortName: string;
  denomination: string;
}

interface PrepagaSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  readOnly?: boolean;
}

function parseReadOnlyValue(value: string) {
  const parts = value.split('/');
  if (parts.length >= 2) {
    return {
      shortName: parts[0].trim(),
      denomination: parts.slice(1).join('/').trim(),
    };
  }
  return { shortName: value, denomination: '' };
}

export function PrepagaSelector({
  value,
  onChange,
  placeholder,
  label,
  error,
  readOnly,
}: PrepagaSelectorProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (opened) {
      setSearchValue(value || '');
    }
  }, [opened, value]);

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
      const formattedValue = `${prepaga.shortName} / ${prepaga.denomination}`;
      onChange(formattedValue);
      setSearchValue(formattedValue);
      setOpened(false);
    },
    [onChange],
  );

  const handleCustomSubmit = useCallback(() => {
    if (searchValue.trim()) {
      onChange(searchValue.trim());
      setOpened(false);
    }
  }, [searchValue, onChange]);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCustomSubmit();
      }
    },
    [handleCustomSubmit],
  );

  const handleBlur = useCallback(() => {
    if (searchValue.trim() && searchValue !== value) {
      handleCustomSubmit();
    }
  }, [searchValue, value, handleCustomSubmit]);

  const handleClick = useCallback(() => {
    if (!readOnly) setOpened(true);
  }, [readOnly]);

  const parsed = useMemo(
    () => (value ? parseReadOnlyValue(value) : null),
    [value],
  );

  if (readOnly) {
    return (
      <Flex direction="column" flex={1}>
        {parsed ? (
          <Stack gap={0}>
            <MantineText size="sm">{parsed.shortName}</MantineText>
            {parsed.denomination && (
              <MantineText size="xs" c="dimmed">
                {parsed.denomination}
              </MantineText>
            )}
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
              {!opened && value && (
                <MantineText size="sm" style={{ flex: 1 }}>
                  {value}
                </MantineText>
              )}
              {(opened || !value) && (
                <StyledInput
                  value={searchValue}
                  onChange={handleSearchChange}
                  onFocus={handleFocus}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
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
                    {results.map((prepaga: Prepaga) => {
                      const formatted = `${prepaga.shortName} / ${prepaga.denomination}`;
                      return (
                        <TableRow
                          key={prepaga.id}
                          onMouseDown={e => {
                            e.preventDefault();
                            handleSelect(prepaga);
                          }}
                          selected={value === formatted}
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
                            {value === formatted && (
                              <Check
                                size={14}
                                color="var(--mantine-color-blue-6)"
                              />
                            )}
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
      </Popover>
    </Flex>
  );
}
