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
  const autoCheckCompletedAt = parentData?.identityVerification?.autoCheckCompletedAt;

  // Auto-start polling if we land on the page while checks are still running
  useEffect(() => {
    if (status === 'pending' && !autoCheckCompletedAt) {
      setAutoChecksRunning(true);
    }
  }, [status, autoCheckCompletedAt]);

  // Stop polling when checks complete
  useEffect(() => {
    if (autoChecksRunning && autoCheckCompletedAt) {
      setAutoChecksRunning(false);
    }
  }, [autoChecksRunning, autoCheckCompletedAt]);

  // Poll every 3s while auto-checks are running, stop after 180s
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

  if (!parentData || !parentData.isMedic) return null;

  return (
    <IdentityVerificationForm
      currentStatus={status ?? 'none'}
      rejectionReason={parentData.identityVerification?.rejectionReason}
      autoCheckProgress={parentData.identityVerification?.autoCheckProgress}
      onSubmitted={handleSubmitted}
      autoChecksRunning={autoChecksRunning}
    />
  );
}
