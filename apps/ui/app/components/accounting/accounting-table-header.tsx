import type { TFunction } from 'i18next';
import { Checkbox, Group, Menu, Table } from '@mantine/core';
import { CaretDownIcon } from '@phosphor-icons/react';

interface AccountingTableHeaderProps {
  unbilledCount: number;
  hasUncosted: boolean;
  selectedForBillingSize: number;
  selectedForBackfillSize: number;
  onHeaderCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectAllBilling: () => void;
  onSelectAllBackfill: () => void;
  t: TFunction;
}

export function AccountingTableHeader({
  unbilledCount,
  hasUncosted,
  selectedForBillingSize,
  selectedForBackfillSize,
  onHeaderCheckboxChange,
  onSelectAllBilling,
  onSelectAllBackfill,
  t,
}: AccountingTableHeaderProps) {
  const showControls = unbilledCount > 0 || hasUncosted;

  return (
    <Table.Thead className="accounting-thead">
      <Table.Tr>
        <Table.Th
          style={{ border: '1px solid var(--mantine-primary-color-1)', borderLeft: 'none', width: 56 }}
          fw={500}
          py="0.5em"
        >
          <Group gap={2} wrap="nowrap">
            {showControls && (
              <Checkbox
                size="xs"
                checked={unbilledCount > 0 && selectedForBillingSize === unbilledCount}
                indeterminate={
                  (selectedForBillingSize > 0 && selectedForBillingSize < unbilledCount) || selectedForBackfillSize > 0
                }
                onChange={onHeaderCheckboxChange}
              />
            )}
            {showControls && (
              <Menu position="bottom-start" withinPortal>
                <Menu.Target>
                  <CaretDownIcon size={12} style={{ cursor: 'pointer', opacity: 0.6 }} />
                </Menu.Target>
                <Menu.Dropdown>
                  {unbilledCount > 0 && (
                    <Menu.Item onClick={onSelectAllBilling}>{t('accounting.select_all_unbilled')}</Menu.Item>
                  )}
                  {hasUncosted && (
                    <Menu.Item onClick={onSelectAllBackfill}>{t('accounting.select_all_backfillable')}</Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Table.Th>
        {[
          t('accounting.col_date'),
          t('accounting.col_type'),
          t('accounting.col_insurer'),
          t('accounting.col_patient'),
          t('accounting.col_cost'),
          t('accounting.col_status'),
        ].map((label, idx) => (
          <Table.Th
            key={label}
            style={{
              border: '1px solid var(--mantine-primary-color-1)',
              ...(idx === 5 && { borderRight: 'none' }),
            }}
            fw={500}
            fz="md"
            py="0.5em"
          >
            {label}
          </Table.Th>
        ))}
      </Table.Tr>
    </Table.Thead>
  );
}
