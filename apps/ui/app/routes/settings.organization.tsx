import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { useRouteLoaderData } from '@remix-run/react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { ProfileOrganization } from '~/components/profile-organization';
import type { loader as profileLoader } from '~/routes/settings';

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  let client;
  try {
    const authenticated = await getAuthenticatedClient(request);
    client = authenticated.client;
  } catch (error) {
    throw redirect('/login');
  }

  try {
    if (intent === 'update-organization') {
      const orgId = String(formData.get('orgId') || '');
      const name = String(formData.get('name') || '');
      const address = String(formData.get('address') || '');
      const phone = String(formData.get('phone') || '');
      const email = String(formData.get('email') || '');
      const logoUrl = String(formData.get('logoUrl') || '');
      const refesId = String(formData.get('refesId') || '');
      const slug = String(formData.get('slug') || '');

      const org = await client.service('organizations').get(orgId);
      const settings = { ...((org as any)?.settings || {}) };
      settings.healthCenter = {
        ...(settings.healthCenter || {}),
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        logoUrl: logoUrl || undefined,
      };
      settings.refesId = refesId || undefined;

      const patchData: Record<string, unknown> = { name, settings };
      if (slug && slug !== (org as any)?.slug) {
        patchData.slug = slug;
      }

      await client.service('organizations').patch(orgId, patchData);
      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    const slugError = error?.errors?.slug as 'invalid' | 'reserved' | 'taken' | undefined;
    return json({ ok: false, intent, error: error?.message || 'Operation failed', slugError }, { status: 400 });
  }
};

export default function ProfileOrganizationRoute() {
  const parentData = useRouteLoaderData<typeof profileLoader>('routes/settings');

  if (!parentData?.isOrgOwner || !parentData.currentOrg) return null;

  return (
    <ProfileOrganization
      currentOrg={parentData.currentOrg}
      bookingHostSuffix={parentData.bookingHostSuffix}
      showFormActions
    />
  );
}
