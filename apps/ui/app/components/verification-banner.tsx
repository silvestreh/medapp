import { Alert, Anchor } from '@mantine/core';
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
      {t(
        'verification.unverified_message',
        'Your medical license has not been verified. Please go to your Profile to verify your license.'
      )}{' '}
      <Anchor component={Link} to="/profile" fw={600}>
        {t('common.view', 'View')}
      </Anchor>
    </Alert>
  );
}
