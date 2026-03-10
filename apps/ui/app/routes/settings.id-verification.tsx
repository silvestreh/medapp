import { useCallback, useEffect, useState } from 'react';
import { useRevalidator, useRouteLoaderData } from '@remix-run/react';

import { IdentityVerificationForm } from '~/components/identity-verification-form';
import type { loader as settingsLoader } from '~/routes/settings';

export default function SettingsIdVerification() {
  const parentData = useRouteLoaderData<typeof settingsLoader>('routes/settings');
  const revalidator = useRevalidator();
  const [autoChecksRunning, setAutoChecksRunning] = useState(false);

  const handleSubmitted = useCallback(() => {
    revalidator.revalidate();
    setAutoChecksRunning(true);
  }, [revalidator]);

  const status = parentData?.identityVerification?.status;

  // Poll every 3s while auto-checks are running, stop when status changes or after 60s
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
    }, 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [autoChecksRunning, status, revalidator]);

  if (!parentData || !parentData.isMedic) return null;

  return (
    <IdentityVerificationForm
      currentStatus={status ?? 'none'}
      rejectionReason={parentData.identityVerification?.rejectionReason}
      onSubmitted={handleSubmitted}
      autoChecksRunning={autoChecksRunning}
    />
  );
}
