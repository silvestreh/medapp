import { useMemo } from 'react';
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
import { useActionData, useNavigation, useRouteLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { parseFormJson } from '~/utils/parse-form-json';
import { ProfileForm } from '~/components/profile-form';
import type { loader as profileLoader } from '~/routes/settings';

function buildSelectOptions(obj: Record<string, string>) {
  return Object.entries(obj).map(([value, label]) => ({ value, label }));
}

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
    if (intent === 'update-profile') {
      const payload = parseFormJson<{
        personalData?: Record<string, unknown>;
        contactData?: Record<string, unknown>;
        mdSettings?: Record<string, unknown>;
      }>(formData.get('payload'));
      await client.service('profile').create({
        action: 'update-profile',
        personalData: payload.personalData,
        contactData: payload.contactData,
        mdSettings: payload.mdSettings,
      });
      return json({ ok: true, intent });
    }

    if (intent === 'verify-license') {
      const payload = parseFormJson<{
        personalData?: Record<string, unknown>;
        contactData?: Record<string, unknown>;
        mdSettings?: Record<string, unknown>;
      }>(formData.get('payload'));

      // Update profile first to ensure DNI is saved
      await client.service('profile').create({
        action: 'update-profile',
        personalData: payload.personalData,
        contactData: payload.contactData,
        mdSettings: payload.mdSettings,
      });

      // Then verify
      const result = await client.service('practitioner-verification').create({});
      return json({ ok: true, intent, result });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json({ ok: false, intent, error: error?.message || 'Operation failed' }, { status: 400 });
  }
};

export default function ProfileIndex() {
  const parentData = useRouteLoaderData<typeof profileLoader>('routes/settings');
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const isSavingProfile = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'update-profile';
  const isVerifyingLicense =
    navigation.state === 'submitting' && navigation.formData?.get('intent') === 'verify-license';

  const countryOptions = useMemo(
    () => buildSelectOptions(t('countries', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const provinceOptions = useMemo(
    () => buildSelectOptions(t('provinces', { returnObjects: true }) as Record<string, string>),
    [t]
  );

  if (!parentData) return null;

  return (
    <ProfileForm
      user={parentData.user}
      mdSettings={parentData.mdSettings}
      isMedic={parentData.isMedic}
      actionData={actionData}
      countryOptions={countryOptions}
      provinceOptions={provinceOptions}
      isSavingProfile={isSavingProfile}
      isVerifyingLicense={isVerifyingLicense}
    />
  );
}
