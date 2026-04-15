import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Anchor, CloseButton, Stack, Text } from '@mantine/core';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    __remixManifest?: { version: string };
  }
}

const POLL_INTERVAL = 5_000;

export function NewVersionBanner() {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const version = window.__remixManifest?.version;
    if (!version) return;

    const checkVersion = async () => {
      try {
        const res = await fetch(`/__manifest?version=${version}`);
        if (res.status === 204) {
          setVisible(true);
          clearInterval(intervalRef.current);
        }
      } catch {
        // Network error — skip this check
      }
    };

    intervalRef.current = setInterval(checkVersion, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <Alert
      color="blue"
      icon={<ArrowsClockwiseIcon size={24} />}
      py="md"
      px="md"
      radius="md"
      styles={{
        root: {
          position: 'fixed',
          bottom: '5.5rem',
          left: '6rem',
          zIndex: 1000,
          width: 260,
          backgroundColor: 'white',
          boxShadow: 'var(--mantine-shadow-xl)',
          border: '1px solid var(--mantine-color-gray-3)',
        },
      }}
    >
      <Stack gap="xs" mb="sm" pb="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Text size="sm">{t('common.new_version_available', 'A new version is available.')}</Text>
      </Stack>
      <Anchor component="button" type="button" onClick={handleReload} fw={600} size="sm">
        {t('common.reload_now', 'Reload now')}
      </Anchor>
      <CloseButton onClick={handleDismiss} size="sm" style={{ position: 'absolute', top: 8, right: 8 }} />
    </Alert>
  );
}
