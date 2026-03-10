import { useCallback } from 'react';
import { useRevalidator, useRouteLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Text } from '@mantine/core';

import { IdentityVerificationForm } from '~/components/identity-verification-form';
import type { loader as settingsLoader } from '~/routes/settings';

export default function SettingsIdVerification() {
  const parentData = useRouteLoaderData<typeof settingsLoader>('routes/settings');
  const revalidator = useRevalidator();
  const { t } = useTranslation();

  const handleSubmitted = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

  if (!parentData || !parentData.isMedic) return null;

  return (
    <IdentityVerificationForm
      currentStatus={parentData.identityVerification?.status ?? 'none'}
      rejectionReason={parentData.identityVerification?.rejectionReason}
      onSubmitted={handleSubmitted}
    />
  );
}
