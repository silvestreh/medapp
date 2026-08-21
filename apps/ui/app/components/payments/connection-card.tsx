import { useCallback, useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { PlugsConnectedIcon, WalletIcon, WarningIcon } from '@phosphor-icons/react';

import { FormCard } from '~/components/forms/styles';

export interface PaymentConnection {
  connected: boolean;
  status: 'connected' | 'refresh_failed' | 'disconnected';
  provider: string;
  accountHint: string | null;
  lastRefreshedAt: string | null;
}

interface ConnectionCardProps {
  connection: PaymentConnection | null;
  settingsEnabled: boolean;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function ConnectionCard({
  connection,
  settingsEnabled,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
}: ConnectionCardProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpenConfirm = useCallback(() => setConfirmOpen(true), []);
  const handleCloseConfirm = useCallback(() => setConfirmOpen(false), []);
  const handleConfirmDisconnect = useCallback(() => {
    setConfirmOpen(false);
    onDisconnect();
  }, [onDisconnect]);

  const isConnected = Boolean(connection?.connected);
  const isBroken = Boolean(
    connection && !connection.connected && (connection.status === 'refresh_failed' || settingsEnabled)
  );

  return (
    <FormCard>
      {!isConnected && !isBroken && (
        <Stack align="center" gap="md" p="lg">
          <Text ta="center">{t('payments.connection.not_connected')}</Text>
          <Button onClick={onConnect} loading={connecting} leftSection={<WalletIcon size={16} />}>
            {t('payments.connection.connect')}
          </Button>
        </Stack>
      )}

      {isBroken && (
        <Stack gap="md" p="lg">
          <Alert color="red" icon={<WarningIcon />} title={t('payments.connection.revoked_title')}>
            {t('payments.connection.revoked_notice')}
          </Alert>
          <Button onClick={onConnect} loading={connecting} leftSection={<WalletIcon size={16} />}>
            {t('payments.connection.reconnect')}
          </Button>
        </Stack>
      )}

      {isConnected && (
        <Stack gap="md" p="lg">
          <Group>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-green-6)',
              }}
            />
            <Text fw={500}>{t('payments.connection.connected')}</Text>
          </Group>
          {connection?.accountHint && (
            <Text size="sm" c="dimmed">
              {t('payments.connection.connected_as')}: {connection.accountHint}
            </Text>
          )}
          {connection?.lastRefreshedAt && (
            <Text size="sm" c="dimmed">
              {t('payments.connection.connected_since')}: {new Date(connection.lastRefreshedAt).toLocaleDateString()}
            </Text>
          )}
          <Button
            onClick={handleOpenConfirm}
            loading={disconnecting}
            variant="light"
            color="red"
            leftSection={<PlugsConnectedIcon size={16} />}
          >
            {t('payments.connection.disconnect')}
          </Button>
        </Stack>
      )}

      <Modal
        opened={confirmOpen}
        onClose={handleCloseConfirm}
        title={t('payments.connection.disconnect_confirm_title')}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t('payments.connection.disconnect_confirm_message')}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={handleCloseConfirm}>
              {t('common.cancel')}
            </Button>
            <Button color="red" onClick={handleConfirmDisconnect}>
              {t('payments.connection.disconnect')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </FormCard>
  );
}
