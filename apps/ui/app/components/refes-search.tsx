import { useCallback, useMemo, useState, type FC, type MouseEvent } from 'react';
import { ActionIcon, Combobox, Input, InputBase, Loader, Text, useCombobox } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';

import { useFind, useGet } from '~/components/provider';

interface RefesEstablishment {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  isActive?: boolean;
}

interface RefesSearchProps {
  value: string;
  onChange: (refesId: string) => void;
  description?: string;
}

function establishmentLabel(e: RefesEstablishment): string {
  const location = [e.city, e.province].filter(Boolean).join(', ');
  return location ? `${e.name} — ${location}` : e.name;
}

/**
 * Searchable selector for REFES establishments, backed by the local mirror
 * of the national registry (refes-establishments service). Uses Combobox
 * (instead of Select) so the selected value can render the REFES code
 * prominently with the establishment name dimmed.
 */
export const RefesSearch: FC<RefesSearchProps> = ({ value, onChange, description }) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 500);

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.focusSearchInput(),
  });

  const query = useMemo(() => ({ $search: debouncedSearch, $limit: 20 }), [debouncedSearch]);

  const {
    response: { data: results = [] },
    isLoading,
  } = useFind('refes-establishments', query, {
    enabled: debouncedSearch.trim().length >= 3,
  });

  // Resolve the label of an already-saved REFES id that isn't among the
  // current search results
  const { data: selected } = useGet('refes-establishments', value, {
    enabled: Boolean(value),
  });

  const { selectedLabel, selectedInactive } = useMemo(() => {
    if (!value) return { selectedLabel: null, selectedInactive: false };
    const fromResults = (results as RefesEstablishment[]).find(e => e.id === value);
    const establishment = fromResults || (selected as RefesEstablishment | undefined);
    return {
      selectedLabel: establishment ? establishmentLabel(establishment) : null,
      selectedInactive: establishment ? establishment.isActive === false : false,
    };
  }, [value, results, selected]);

  const handleOptionSubmit = useCallback(
    (newValue: string) => {
      onChange(newValue);
      combobox.closeDropdown();
    },
    [onChange, combobox]
  );

  const handleClear = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onChange('');
      setSearchValue('');
    },
    [onChange]
  );

  const handleToggle = useCallback(() => {
    combobox.toggleDropdown();
  }, [combobox]);

  const options = (results as RefesEstablishment[]).map(establishment => (
    <Combobox.Option value={establishment.id} key={establishment.id}>
      <Text size="sm">{establishmentLabel(establishment)}</Text>
      <Text size="xs" c="dimmed">
        {establishment.id}
      </Text>
    </Combobox.Option>
  ));

  return (
    <Combobox store={combobox} withinPortal onOptionSubmit={handleOptionSubmit}>
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          variant="unstyled"
          pointer
          style={{ flex: 1 }}
          description={description}
          onClick={handleToggle}
          rightSectionPointerEvents={value ? 'auto' : 'none'}
          rightSection={
            value ? (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label={t('common.clear', 'Limpiar')}
                onClick={handleClear}
              >
                <XIcon size={14} />
              </ActionIcon>
            ) : (
              <Combobox.Chevron />
            )
          }
        >
          {value ? (
            <>
              <Text span fw={600}>
                {value}
              </Text>
              {selectedLabel && (
                <Text span c="dimmed">
                  {' '}
                  ({selectedLabel})
                </Text>
              )}
              {selectedInactive && (
                <Text span c="orange" size="sm">
                  {' '}
                  {t('profile.org_refes_inactive', '— ya no figura en el registro REFES')}
                </Text>
              )}
            </>
          ) : (
            <Input.Placeholder>
              {t('profile.org_refes_placeholder', 'Buscá tu establecimiento por nombre o localidad')}
            </Input.Placeholder>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          value={searchValue}
          onChange={event => setSearchValue(event.currentTarget.value)}
          placeholder={t('profile.org_refes_search_placeholder', 'Nombre, localidad o código REFES')}
          rightSection={isLoading ? <Loader size="xs" /> : undefined}
        />
        <Combobox.Options mah={300} style={{ overflowY: 'auto' }}>
          {options}
          {options.length === 0 && (
            <Combobox.Empty>
              {debouncedSearch.trim().length >= 3 && !isLoading
                ? t('profile.org_refes_no_results', 'Sin resultados')
                : t('profile.org_refes_min_chars', 'Escribí al menos 3 letras para buscar')}
            </Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
};
