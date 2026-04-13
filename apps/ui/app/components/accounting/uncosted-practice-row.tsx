import type { TFunction } from 'i18next';
import { Badge, Checkbox, Table } from '@mantine/core';
import dayjs from 'dayjs';

import type { UncostedPractice } from './types';
import { CellText } from './cell-text';

interface UncostedPracticeRowProps {
  practice: UncostedPractice;
  idx: number;
  selectedForBackfill: Set<string>;
  onToggleBackfill: (practiceId: string, idx: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  translateType: (kind: string) => string;
  insurerNameById: Map<string, string>;
  t: TFunction;
  isFirst: boolean;
}

export function UncostedPracticeRow({
  practice,
  idx,
  selectedForBackfill,
  onToggleBackfill,
  translateType,
  insurerNameById,
  t,
  isFirst,
}: UncostedPracticeRowProps) {
  return (
    <Table.Tr
      style={{ opacity: 0.6 }}
      styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
      {...(isFirst ? { 'data-tour': 'accounting-untracked' } : {})}
    >
      <Table.Td>
        <Checkbox
          size="xs"
          checked={selectedForBackfill.has(practice.practiceId)}
          onChange={e => onToggleBackfill(practice.practiceId, idx, e)}
        />
      </Table.Td>
      <Table.Td>
        <CellText>{dayjs(practice.date).format('YYYY-MM-DD')}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>
          {practice.practiceType === 'studies'
            ? (practice.studies || []).map(s => translateType(s)).join(', ')
            : translateType('encounter')}
        </CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{insurerNameById.get(practice.effectiveInsurerId) || '-'}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{practice.patientName}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText style={{ color: 'var(--mantine-color-dimmed)' }}>$0.00</CellText>
      </Table.Td>
      <Table.Td>
        <Badge size="xs" color="orange">
          {t('accounting.uncosted')}
        </Badge>
      </Table.Td>
    </Table.Tr>
  );
}
