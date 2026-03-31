import type { TFunction } from 'i18next';
import { Badge, Checkbox, Table } from '@mantine/core';
import dayjs from 'dayjs';

import type { AccountingRecord } from './types';
import { CellText } from './cell-text';

interface AccountingRecordRowProps {
  record: AccountingRecord;
  unbilledIdx: number;
  selectedForBilling: Set<string>;
  onToggleBilling: (
    practiceCostId: string,
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  translateType: (kind: string) => string;
  t: TFunction;
}

export function AccountingRecordRow({
  record,
  unbilledIdx,
  selectedForBilling,
  onToggleBilling,
  translateType,
  t,
}: AccountingRecordRowProps) {
  return (
    <Table.Tr
      styles={{ tr: { borderColor: 'var(--mantine-color-gray-1)' } }}
      style={record.billedAt ? { opacity: 0.6 } : undefined}
    >
      <Table.Td>
        {!record.billedAt && (
          <Checkbox
            size="xs"
            checked={selectedForBilling.has(record.practiceCostId)}
            onChange={e => onToggleBilling(record.practiceCostId, unbilledIdx, e)}
          />
        )}
      </Table.Td>
      <Table.Td>
        <CellText>{dayjs(record.date).format('YYYY-MM-DD')}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{translateType(record.kind)}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{record.insurerName}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>{record.patientName}</CellText>
      </Table.Td>
      <Table.Td>
        <CellText>${record.cost.toFixed(2)}</CellText>
      </Table.Td>
      <Table.Td>
        {record.billedAt && (
          <Badge size="xs" color="green">
            {t('accounting.billed')}
          </Badge>
        )}
        {!record.billedAt && (
          <Badge size="xs" color="yellow">
            {t('accounting.unbilled')}
          </Badge>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
