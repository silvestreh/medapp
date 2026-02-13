import { useState, useMemo, type FC, useEffect, useRef } from 'react';
import { Table, TextInput, Stack, Loader, Text as BaseText, Pagination, Group, Button } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { Search, User } from 'lucide-react';
import { useNavigate, useSearchParams } from '@remix-run/react';

import { useFind } from '~/components/provider';
import type { Patient } from '~/declarations';
import Portal from '~/components/portal';
import { styled } from '~/styled-system/jsx';
import { displayDocumentValue } from '~/utils';
import { css } from '~/styled-system/css';

const Wrapper = styled('div', {
  base: {
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    width: '100%',
  },

  variants: {
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
});

const CellText = styled('span', {
  base: {
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    display: 'block',
    padding: 'var(--mantine-spacing-xs)',
    fontSize: 'var(--mantine-font-size-sm)',
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

const HeaderContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',

    sm: {
      padding: '1em',
    },
    md: {
      padding: '2em 2em 1em',
    },
  },
});

const Title = styled('h1', {
  base: {
    fontSize: '1.5rem',
    lineHeight: 1,
    fontWeight: 700,
    flex: 1,
    margin: 0,

    md: {
      fontSize: '2rem',
    },

    lg: {
      fontSize: '2.25rem',
    },
  },
});

const PatientSearchTable: FC = () => {
  const { t } = useTranslation();
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
      $limit: 15,
      $skip: (page - 1) * 10,
    }),
    [debouncedInputValue, page]
  );

  const { response, isLoading } = useFind('patients', query);

  const patients = (response as any).data || [];
  const total = (response as any).total || 0;
  const totalPages = Math.ceil(total / 10);

  const rows = patients.map((patient: Patient) => (
    <Table.Tr
      key={patient.id}
      onClick={() => navigate(`/encounters/${patient.id}`)}
      styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
      style={{ cursor: 'pointer' }}
    >
      <Table.Td>
        <CellText>{patient.personalData.firstName || '—'}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{patient.personalData.lastName || '—'}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{displayDocumentValue(patient.personalData.documentValue)}</CellText>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
      <Portal id="toolbar">
        <TextInput
          ref={inputRef}
          autoFocus
          placeholder={t('patients.search_placeholder')}
          value={inputValue}
          onChange={event => setInputValue(event.currentTarget.value)}
          leftSection={isLoading ? <Loader size={16} /> : <Search size={16} />}
          variant="unstyled"
          size="lg"
          flex={1}
          styles={{ input: { lineHeight: 1, height: 'auto', minHeight: 0 } }}
          autoComplete="off"
          data-1p-ignore
        />
      </Portal>

      <Wrapper hideOnMobileIfEmpty={rows.length === 0}>
        <HeaderContainer>
          <Title>{t('patients.title')}</Title>
        </HeaderContainer>
        <Table
          highlightOnHover={rows.length > 0}
          layout="fixed"
          bg="white"
          className={css({
            lg: {
              borderLeft: '1px solid var(--mantine-color-gray-2)',
              marginLeft: '-1px',
            },
          })}
        >
          <Table.Thead>
            <Table.Tr bg="blue.0">
              <Table.Th
                style={{ border: '1px solid var(--mantine-color-blue-1)', borderLeft: 'none' }}
                fw={500}
                fz="md"
                py="0.5em"
              >
                {t('patients.col_first_name')}
              </Table.Th>
              <Table.Th style={{ border: '1px solid var(--mantine-color-blue-1)' }} fw={500} fz="md" py="0.5em">
                {t('patients.col_last_name')}
              </Table.Th>
              <Table.Th
                style={{ border: '1px solid var(--mantine-color-blue-1)', borderRight: 'none' }}
                fw={500}
                fz="md"
                py="0.5em"
              >
                {t('patients.col_document')}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length > 0 && rows}
            {rows.length === 0 && (
              <Table.Tr
                styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
                onClick={() => inputRef.current?.focus()}
              >
                <Table.Td colSpan={3}>
                  <EmptyState>
                    {inputValue && !isLoading ? (
                      <User size={48} color="var(--mantine-color-dimmed)" />
                    ) : (
                      <Search size={48} color="var(--mantine-color-dimmed)" />
                    )}
                    <BaseText c="dimmed" ta="center">
                      {inputValue && !isLoading ? t('patients.no_results') : t('patients.search_prompt')}
                    </BaseText>
                    <Button size="lg" mt="xl" onClick={() => inputRef.current?.focus()} variant="light">
                      {t('common.search')}
                    </Button>
                  </EmptyState>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Wrapper>

      {totalPages > 1 && (
        <Group
          justify="center"
          bg="white"
          py="lg"
          className={css({
            lg: {
              position: 'sticky',
              bottom: 0,
              borderTop: '1px solid var(--mantine-color-gray-1)',
            },
          })}
        >
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
};

export default PatientSearchTable;
