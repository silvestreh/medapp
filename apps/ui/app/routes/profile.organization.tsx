import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { useRouteLoaderData } from '@remix-run/react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { ProfileOrganization } from '~/components/profile-organization';
import type { loader as profileLoader } from '~/routes/profile';

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
      await client.service('organizations').patch(orgId, { name });
      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, intent, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

export default function ProfileOrganizationRoute() {
  const parentData = useRouteLoaderData<typeof profileLoader>('routes/profile');

  if (!parentData?.isOrgOwner || !parentData.currentOrg) return null;

  return <ProfileOrganization currentOrg={parentData.currentOrg} showFormActions />;
}
