import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouteLoaderData } from '@remix-run/react';
import { Button, Card, Group, Image, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { WhatsappLogoIcon, PlugsConnectedIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react';

import { useFeathers } from '~/components/provider';
import type { loader as settingsLoader } from '~/routes/settings';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export default function WhatsAppSettingsRoute() {
  const parentData = useRouteLoaderData<typeof settingsLoader>('routes/settings');
  const { t } = useTranslation();
  const feathers = useFeathers();

  const [state, setState] = useState<ConnectionState>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const waSettings = parentData?.currentOrg?.settings?.whatsapp as
    | {
        instanceName?: string;
        connected?: boolean;
        connectedPhone?: string;
        connectedAt?: string;
      }
    | undefined;

  useEffect(() => {
    if (waSettings?.connected) {
      setState('connected');
    } else if (waSettings?.instanceName) {
      setState('connecting');
    }
  }, [waSettings?.connected, waSettings?.instanceName]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback(
    (interval: number) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const result = (await feathers.service('whatsapp-instances').create({ action: 'check-status' })) as any;
          if (result.connected && state !== 'connected') {
            setState('connected');
            setQrCode(null);
            // Restart polling at a slower rate for connection monitoring
            stopPolling();
            startPolling(15000);
          } else if (!result.connected && state === 'connected') {
            // External disconnect detected
            setState('idle');
            stopPolling();
            window.location.reload();
          }
        } catch {
          // Polling error, continue
        }
      }, interval);
    },
    [feathers, stopPolling, state]
  );

  // Poll while on the page and there's an active instance
  useEffect(() => {
    if (state === 'connected') {
      startPolling(15000);
    } else if (state === 'connecting') {
      startPolling(4000);
    }
    return () => stopPolling();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await feathers.service('whatsapp-instances').create({ action: 'create-instance' })) as any;
      if (result.qrcode) {
        const base64 = result.qrcode.startsWith('data:') ? result.qrcode : `data:image/png;base64,${result.qrcode}`;
        setQrCode(base64);
      }
      setState('connecting');
    } catch (err) {
      console.error('Failed to create WhatsApp instance:', err);
      setState('error');
    } finally {
      setLoading(false);
    }
  }, [feathers]);

  const handleRefreshQr = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await feathers.service('whatsapp-instances').create({ action: 'get-qrcode' })) as any;
      const qr = result.qrcode || result.code;
      if (qr) {
        const base64 = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
        setQrCode(base64);
      }
    } catch (err) {
      console.error('Failed to refresh QR code:', err);
    } finally {
      setLoading(false);
    }
  }, [feathers]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await feathers.service('whatsapp-instances').create({ action: 'disconnect' });
      setState('idle');
      setQrCode(null);
      stopPolling();
      window.location.reload();
    } catch (err) {
      console.error('Failed to disconnect WhatsApp:', err);
    } finally {
      setDisconnecting(false);
    }
  }, [feathers, stopPolling]);

  if (!parentData?.isOrgOwner || !parentData.currentOrg) return null;

  return (
    <Stack gap="lg" maw={600}>
      <Group gap="sm">
        <WhatsappLogoIcon size={24} />
        <Title order={3}>{t('profile.whatsapp_title')}</Title>
      </Group>

      <Text c="dimmed" size="sm">
        {t('profile.whatsapp_description')}
      </Text>

      {state === 'idle' && (
        <Card withBorder padding="lg">
          <Stack align="center" gap="md">
            <Text ta="center">{t('profile.whatsapp_not_connected')}</Text>
            <Button onClick={handleConnect} loading={loading} leftSection={<WhatsappLogoIcon size={16} />}>
              {t('profile.whatsapp_connect')}
            </Button>
          </Stack>
        </Card>
      )}

      {state === 'connecting' && (
        <Card withBorder padding="lg">
          <Stack align="center" gap="md">
            <Text fw={500}>{t('profile.whatsapp_scan_qr')}</Text>
            <Text size="sm" c="dimmed" ta="center">
              {t('profile.whatsapp_scan_instructions')}
            </Text>
            {qrCode && <Image src={qrCode} alt="WhatsApp QR Code" w={280} h={280} fit="contain" />}
            {!qrCode && (
              <Button
                onClick={handleRefreshQr}
                loading={loading}
                variant="light"
                leftSection={<ArrowsClockwiseIcon size={16} />}
              >
                {t('profile.whatsapp_get_qr')}
              </Button>
            )}
            {qrCode && (
              <Button
                onClick={handleRefreshQr}
                loading={loading}
                variant="subtle"
                size="xs"
                leftSection={<ArrowsClockwiseIcon size={14} />}
              >
                {t('profile.whatsapp_refresh_qr')}
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {state === 'connected' && (
        <Card withBorder padding="lg">
          <Stack gap="md">
            <Group>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-green-6)',
                }}
              />
              <Text fw={500}>{t('profile.whatsapp_connected')}</Text>
            </Group>
            {waSettings?.connectedPhone && (
              <Text size="sm" c="dimmed">
                {t('profile.whatsapp_connected_phone')}: {waSettings.connectedPhone}
              </Text>
            )}
            {waSettings?.connectedAt && (
              <Text size="sm" c="dimmed">
                {t('profile.whatsapp_connected_since')}: {new Date(waSettings.connectedAt).toLocaleDateString()}
              </Text>
            )}
            <Button
              onClick={handleDisconnect}
              loading={disconnecting}
              variant="light"
              color="red"
              leftSection={<PlugsConnectedIcon size={16} />}
            >
              {t('profile.whatsapp_disconnect')}
            </Button>
          </Stack>
        </Card>
      )}

      {state === 'error' && (
        <Card withBorder padding="lg">
          <Stack align="center" gap="md">
            <Text c="red">{t('profile.whatsapp_error')}</Text>
            <Button onClick={handleConnect} loading={loading}>
              {t('profile.whatsapp_retry')}
            </Button>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
