import type { TFunction } from 'i18next';
import { Button, Divider, Group, Paper, Stack, Text } from '@mantine/core';

interface AccountingActionBarProps {
  selectedForBillingSize: number;
  selectedForBackfillSize: number;
  hasUncosted: boolean;
  onMarkAsBilled: () => void;
  billingLoading: boolean;
  onBackfillSelected: () => void;
  backfillLoading: boolean;
  t: TFunction;
}

export function AccountingActionBar({
  selectedForBillingSize,
  selectedForBackfillSize,
  hasUncosted,
  onMarkAsBilled,
  billingLoading,
  onBackfillSelected,
  backfillLoading,
  t,
}: AccountingActionBarProps) {
  return (
    <Paper withBorder p="sm" style={{ position: 'sticky', bottom: 0, zIndex: 2 }}>
      <Stack gap="xs">
        {selectedForBillingSize > 0 && (
          <Group justify="space-between">
            <Text size="sm">
              {t('accounting.billing_selected_count', {
                defaultValue: '{{count}} selected',
                count: selectedForBillingSize,
              })}
            </Text>
            <Button size="sm" onClick={onMarkAsBilled} loading={billingLoading}>
              {t('accounting.mark_as_billed', { defaultValue: 'Mark as billed' })}
            </Button>
          </Group>
        )}
        {selectedForBillingSize > 0 && hasUncosted && selectedForBackfillSize > 0 && <Divider opacity={0.5} />}
        {hasUncosted && selectedForBackfillSize > 0 && (
          <Group justify="space-between">
            <Text size="sm">
              {t('accounting.backfill_selected_count', {
                defaultValue: '{{count}} selected for backfill',
                count: selectedForBackfillSize,
              })}
            </Text>
            <Button size="sm" onClick={onBackfillSelected} loading={backfillLoading}>
              {t('accounting.backfill_selected', { defaultValue: 'Backfill selected' })}
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
