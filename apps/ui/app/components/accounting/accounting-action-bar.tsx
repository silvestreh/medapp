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
              {t('accounting.selected_count', {
                count: selectedForBillingSize,
              })}
            </Text>
            <Button size="sm" onClick={onMarkAsBilled} loading={billingLoading}>
              {t('accounting.mark_as_billed')}
            </Button>
          </Group>
        )}
        {selectedForBillingSize > 0 && hasUncosted && selectedForBackfillSize > 0 && <Divider opacity={0.5} />}
        {hasUncosted && selectedForBackfillSize > 0 && (
          <Group justify="space-between">
            <Text size="sm">
              {t('accounting.backfill_selected_count', {
                count: selectedForBackfillSize,
              })}
            </Text>
            <Button size="sm" onClick={onBackfillSelected} loading={backfillLoading}>
              {t('accounting.backfill_selected')}
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
