import { Alert, Button, Group } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from '@remix-run/react';

interface VerificationBannerProps {
  isVerified?: boolean;
}

export function VerificationBanner({ isVerified }: VerificationBannerProps) {
  const { t } = useTranslation();

  if (isVerified) {
    return null;
  }

  return (
    <Alert
      icon={<AlertTriangle size={32} />}
      title={t('verification.unverified_title', 'Unverified Practitioner')}
      color="red"
      styles={{ root: { borderRadius: 0 } }}
    >
      <Group>
        {t('verification.unverified_message')}{' '}
        <Button component={Link} to="/settings/id-verification" fw={600} ml="auto" color="red">
          {t('verification.verify_id')}
        </Button>
      </Group>
    </Alert>
  );
}
