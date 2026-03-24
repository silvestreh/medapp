import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRevalidator, useRouteLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';

import { useFeathers } from '~/components/provider';
import { KycWidget } from '~/components/kyc-widget';
import type { loader as settingsLoader } from '~/routes/settings';

type KycError = {
  message: string;
  code?: string;
  data?: Record<string, unknown>;
};

type ScannedIdData = {
  firstName?: string;
  lastName?: string;
  dniNumber?: string;
  birthDate?: string;
  gender?: string;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return undefined;
};

const KYC_API_URL = (import.meta as any).env?.VITE_KYC_API_URL || 'http://localhost:3032';
const KYC_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_KYC_PUBLISHABLE_KEY || '';

export default function SettingsIdVerification() {
  const parentData = useRouteLoaderData<typeof settingsLoader>('routes/settings');
  const revalidator = useRevalidator();
  const client = useFeathers();
  const { t } = useTranslation();
  const [autoChecksRunning, setAutoChecksRunning] = useState(false);
  const [error, setError] = useState<KycError | null>(null);
  const [updating, setUpdating] = useState(false);

  const status = parentData?.identityVerification?.status;
  const autoCheckCompletedAt = parentData?.identityVerification?.autoCheckCompletedAt;

  const idData = useMemo(() => {
    const user = parentData?.user as any;
    const pd = user?.personalData;
    if (!pd) return null;
    return {
      firstName: pd.firstName || null,
      lastName: pd.lastName || null,
      dniNumber: pd.documentValue || null,
      birthDate: pd.birthDate || null,
      gender: pd.gender || null,
    };
  }, [parentData?.user]);

  const userId = (parentData?.user as any)?.id || '';
  const scanned = useMemo<ScannedIdData | null>(() => {
    if (error?.code !== 'id_mismatch' || !error.data) {
      return null;
    }

    return {
      firstName: toOptionalString(error.data.firstName),
      lastName: toOptionalString(error.data.lastName),
      dniNumber: toOptionalString(error.data.dniNumber),
      birthDate: toOptionalString(error.data.birthDate),
      gender: toOptionalString(error.data.gender),
    };
  }, [error]);

  useEffect(() => {
    if (status === 'pending' && !autoCheckCompletedAt) {
      setAutoChecksRunning(true);
    }
  }, [status, autoCheckCompletedAt]);

  useEffect(() => {
    if (autoChecksRunning && autoCheckCompletedAt) {
      setAutoChecksRunning(false);
    }
  }, [autoChecksRunning, autoCheckCompletedAt]);

  useEffect(() => {
    if (!autoChecksRunning) return;
    if (status && status !== 'pending') {
      setAutoChecksRunning(false);
      return;
    }

    const interval = setInterval(() => {
      revalidator.revalidate();
    }, 3000);

    const timeout = setTimeout(() => {
      setAutoChecksRunning(false);
    }, 180000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [autoChecksRunning, status, revalidator]);

  const handleCompleted = useCallback(() => {
    revalidator.revalidate();
    setAutoChecksRunning(true);
  }, [revalidator]);

  const handleError = useCallback((err: KycError) => {
    setError(err);
  }, []);

  const handleUpdateRecords = useCallback(async () => {
    if (!scanned) return;

    setUpdating(true);

    try {
      const userId = (parentData?.user as any)?.id;
      await (client as any).service('users').patch(userId, {
        personalData: {
          firstName: scanned.firstName,
          lastName: scanned.lastName,
          documentValue: scanned.dniNumber,
          birthDate: scanned.birthDate,
        },
      });
      setError(null);
      revalidator.revalidate();
    } catch {
      setError(null);
    } finally {
      setUpdating(false);
    }
  }, [scanned, client, revalidator, parentData?.user]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  if (!parentData || !parentData.isMedic) return null;

  if (status === 'verified') {
    return (
      <Stack align="center" py="xl">
        <Text c="green" size="lg" fw={600}>
          {t('identity_verification.status_verified')}
        </Text>
      </Stack>
    );
  }

  if (status === 'pending' && autoChecksRunning) {
    return (
      <Stack align="center" py="xl">
        <Text c="yellow.6" size="lg" fw={600}>
          {t('identity_verification.status_pending')}
        </Text>
        <Text c="dimmed" size="sm">
          {t('identity_verification.auto_checking')}
        </Text>
      </Stack>
    );
  }

  if (!idData) {
    return (
      <Stack align="center" py="xl">
        <Text c="red" size="sm">
          {t(
            'identity_verification.missing_personal_data',
            'Completá tus datos personales antes de verificar tu identidad.'
          )}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {scanned && (
        <Alert color="red" title="El DNI escaneado no coincide con tus datos">
          <Stack gap="xs">
            <Text size="sm">¿Querés actualizar tus datos con la información del DNI?</Text>
            {scanned.firstName && (
              <Text size="xs">
                <Text span fw={600}>
                  Nombre:
                </Text>{' '}
                {scanned.firstName}
              </Text>
            )}
            {scanned.lastName && (
              <Text size="xs">
                <Text span fw={600}>
                  Apellido:
                </Text>{' '}
                {scanned.lastName}
              </Text>
            )}
            {scanned.dniNumber && (
              <Text size="xs">
                <Text span fw={600}>
                  DNI:
                </Text>{' '}
                {scanned.dniNumber}
              </Text>
            )}
            <Group mt="xs">
              <Button size="xs" onClick={handleUpdateRecords} color="red" loading={updating}>
                Actualizar mis datos
              </Button>
              <Button size="xs" variant="subtle" color="red" onClick={handleDismissError}>
                Cancelar
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      <KycWidget
        apiKey={KYC_PUBLISHABLE_KEY}
        apiUrl={KYC_API_URL}
        userId={userId}
        idData={idData}
        onCompleted={handleCompleted}
        onError={handleError}
      />
    </Stack>
  );
}
