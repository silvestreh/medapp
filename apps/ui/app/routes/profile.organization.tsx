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

    if (intent === 'save-llm-provider-key') {
      const provider = String(formData.get('provider') || '');
      const apiKey = String(formData.get('apiKey') || '');
      await client.service('llm-provider-keys').create({
        provider,
        apiKey,
      });
      return json({ ok: true, intent });
    }

    if (intent === 'remove-llm-provider-key') {
      const provider = String(formData.get('provider') || '');
      await client.service('llm-provider-keys').remove(provider);
      return json({ ok: true, intent });
    }

    if (intent === 'update-llm-chat-settings') {
      const orgId = String(formData.get('orgId') || '');
      const provider = String(formData.get('provider') || '');
      const model = String(formData.get('model') || '');
      const org = await client.service('organizations').get(orgId);
      const settings = { ...((org as any)?.settings || {}) };
      settings.llmChat = {
        preferredProvider: provider || undefined,
        model: model || undefined,
      };
      await client.service('organizations').patch(orgId, { settings });
      return json({ ok: true, intent });
    }

    if (intent === 'update-recetario-settings') {
      const orgId = String(formData.get('orgId') || '');
      const enabled = formData.get('enabled') === 'true';
      const healthCenterId = formData.get('healthCenterId');
      const org = await client.service('organizations').get(orgId);
      const settings = { ...((org as any)?.settings || {}) };
      settings.recetario = {
        enabled,
        healthCenterId: healthCenterId ? Number(healthCenterId) : null,
      };
      await client.service('organizations').patch(orgId, { settings });
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
