import { type FC, useEffect, useState, useMemo, memo } from 'react';
import { Select, Group, Text, type SelectProps } from '@mantine/core';
import { User } from 'lucide-react';
import { useParams } from '@remix-run/react';

import { styled } from '~/styled-system/jsx';

interface MedicListProps {
  onChange: (value: string | null) => void;
  medics?: any[];
}

const Option = styled(Group, {
  base: {
    minWidth: 'fit-content',
    flex: '1',
    gap: '2px',
    flexWrap: 'nowrap',
  },
});

const MedicList: FC<MedicListProps> = ({ onChange, medics = [] }) => {
  const [search, setSearch] = useState('');
  const [selectedMedic, setSelectedMedic] = useState<string | null>(null);
  const params = useParams();

  const options = useMemo(() => {
    return medics.map((medic: any) => {
      const { personalData, username } = medic;
      const label = `${personalData.firstName || ''} ${personalData.lastName || ''}`.trim() || username;

      return {
        value: medic.id,
        label,
      };
    });
  }, [medics]);

  const handleRenderOption: SelectProps['renderOption'] = ({ option, checked }) => (
    <Option>
      <User color={checked ? 'var(--mantine-color-indigo-6)' : 'var(--mantine-color-dimmed)'} />
      <Text c={checked ? 'indigo' : 'dark'} styles={{ root: { whiteSpace: 'nowrap' } }}>
        {option.label}
      </Text>
    </Option>
  );

  const handleChange = (value: string | null) => {
    setSelectedMedic(value);
    onChange(value);
  };

  useEffect(() => {
    setSelectedMedic(params.medicId || null);
  }, [params.medicId]);

  return (
    <Select
      data={options}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      onFocus={() => setSearch('')}
      clearable={false}
      placeholder="Buscar médico…"
      renderOption={handleRenderOption}
      value={selectedMedic || params.medicId}
      variant="filled"
      onChange={handleChange}
      key={options.length}
      height="100%"
      comboboxProps={{
        position: 'bottom-start',
        width: '20em',
        withArrow: true,
        arrowSize: 12,
      }}
    />
  );
};

export default memo(MedicList);
