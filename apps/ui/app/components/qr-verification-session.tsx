import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Group, Image, Loader, Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { QrCode, RefreshCw, CheckCircle, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';

import { useFeathers } from '~/components/provider';
import { createVerificationClient, getVerificationApiUrl } from '~/verification-feathers';

interface VerificationSession {
  id: string;
  token: string;
  status: 'waiting' | 'uploading' | 'completed' | 'expired';
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  expiresAt: string;
}

interface QrVerificationSessionProps {
  onCompleted: (urls: { idFrontUrl: string; idBackUrl: string; selfieUrl: string }) => void;
}

export function QrVerificationSession({ onCompleted }: QrVerificationSessionProps) {
  const { t } = useTranslation();
  const mainClient = useFeathers();
  const verificationClientRef = useRef<Awaited<ReturnType<typeof createVerificationClient>> | null>(null);
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const createSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExpired(false);
    setSession(null);
    setQrDataUrl(null);

    try {
      const token = await (mainClient as any).authentication?.getAccessToken?.();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const client = await createVerificationClient(token);
      verificationClientRef.current = client;

      // Create a new verification session
      const newSession = await client.service('verification-sessions').create({});
      setSession(newSession as VerificationSession);

      // Generate QR code
      const verifyUrl = `${getVerificationApiUrl()}/verify/${(newSession as VerificationSession).token}`;
      const dataUrl = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 280,
      });
      setQrDataUrl(dataUrl);

      // Listen for real-time updates
      client.service('verification-sessions').on('patched', (updated: VerificationSession) => {
        if (updated.id === (newSession as VerificationSession).id) {
          setSession(updated);

          if (updated.status === 'completed' && updated.idFrontUrl && updated.idBackUrl && updated.selfieUrl) {
            onCompleted({
              idFrontUrl: updated.idFrontUrl,
              idBackUrl: updated.idBackUrl,
              selfieUrl: updated.selfieUrl,
            });
          }
        }
      });

      // Set up expiry timer
      const expiresAt = new Date((newSession as VerificationSession).expiresAt).getTime();
      const timeUntilExpiry = expiresAt - Date.now();
      if (timeUntilExpiry > 0) {
        setTimeout(() => {
          setExpired(true);
        }, timeUntilExpiry);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create verification session');
    } finally {
      setLoading(false);
    }
  }, [mainClient, onCompleted]);

  useEffect(() => {
    createSession();

    return () => {
      if (verificationClientRef.current) {
        (verificationClientRef.current as any).logout?.().catch(() => {});
      }
    };
  }, [createSession]);

  const uploadedCount = session
    ? [session.idFrontUrl, session.idBackUrl, session.selfieUrl].filter(Boolean).length
    : 0;

  if (loading) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Stack align="center" gap="sm">
          <Loader size="md" />
          <Text size="sm" c="dimmed">{t('identity_verification.qr_loading')}</Text>
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" title={t('common.error')}>
        <Text size="sm">{error}</Text>
        <Button mt="sm" variant="light" size="xs" onClick={createSession}>
          {t('common.retry')}
        </Button>
      </Alert>
    );
  }

  if (expired) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Stack align="center" gap="sm">
          <Text fw={600}>{t('identity_verification.qr_expired')}</Text>
          <Text size="sm" c="dimmed">{t('identity_verification.qr_expired_desc')}</Text>
          <Button
            leftSection={<RefreshCw size={16} />}
            variant="light"
            onClick={createSession}
          >
            {t('identity_verification.qr_refresh')}
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="xl" radius="md">
      <Stack align="center" gap="md">
        <Group gap="xs">
          <Smartphone size={20} />
          <Text fw={600}>{t('identity_verification.qr_title')}</Text>
        </Group>

        <Text size="sm" c="dimmed" ta="center">
          {t('identity_verification.qr_instructions')}
        </Text>

        {qrDataUrl && (
          <Image src={qrDataUrl} alt="QR Code" w={280} h={280} />
        )}

        {session && session.status === 'waiting' && (
          <Badge color="gray" variant="light" size="lg">
            {t('identity_verification.qr_waiting')}
          </Badge>
        )}

        {session && session.status === 'uploading' && (
          <Stack align="center" gap="xs">
            <Group gap="xs">
              <Loader size="xs" />
              <Badge color="blue" variant="light" size="lg">
                {t('identity_verification.qr_uploading')}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {uploadedCount}/3 {t('identity_verification.qr_photos_uploaded')}
            </Text>
          </Stack>
        )}

        {session && session.status === 'completed' && (
          <Badge color="green" variant="light" size="lg" leftSection={<CheckCircle size={14} />}>
            {t('identity_verification.qr_completed')}
          </Badge>
        )}
      </Stack>
    </Paper>
  );
}
