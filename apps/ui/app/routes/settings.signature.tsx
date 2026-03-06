import { useCallback } from 'react';
import { useRevalidator, useRouteLoaderData } from '@remix-run/react';

import { ProfileDigitalSignature } from '~/components/profile-digital-signature';
import type { loader as profileLoader } from '~/routes/settings';

export default function ProfileSignatureRoute() {
  const parentData = useRouteLoaderData<typeof profileLoader>('routes/settings');
  const revalidator = useRevalidator();

  const handleCertificateChange = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

  if (!parentData || !parentData.isMedic) return null;

  return (
    <ProfileDigitalSignature
      certificate={parentData.signingCertificate}
      onCertificateChange={handleCertificateChange}
    />
  );
}
