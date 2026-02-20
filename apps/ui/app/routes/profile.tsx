import { useEffect, useMemo, useState } from 'react';
import type { Application } from '@feathersjs/feathers';
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useActionData, useLoaderData, useNavigation, useRevalidator } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { Tabs } from '@mantine/core';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { FormContainer } from '~/components/forms/styles';
import { ProfileForm } from '~/components/profile-form';
import { ProfileSecurity } from '~/components/profile-security';
import Portal from '~/components/portal';
import { css } from '~/styled-system/css';

const buildTwoFactorSetupPayload = async (result: { secret: string; otpauthUri: string }) => {
  const qrCodeDataUrl = await QRCode.toDataURL(result.otpauthUri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
  });

  return {
    secret: result.secret,
    otpauthUri: result.otpauthUri,
    qrCodeDataUrl,
  };
};

export const meta: MetaFunction = () => {
  return [{ title: 'Profile | MedApp' }];
};

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

type MdSettingsProfile = {
  id: string;
  medicalSpecialty: string | null;
  nationalLicenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { client, user } = await getAuthenticatedClient(request);
    const profile = await client.service('profile').get('me');
    const fullUser = await client.service('users').get(user.id);
    const isMedic = (fullUser as { roleId?: string }).roleId === 'medic';
    let mdSettingsRecord: MdSettingsProfile | null = null;
    if (isMedic) {
      const settings = (fullUser as { settings?: unknown }).settings;
      if (settings && typeof settings === 'object' && settings !== null && 'id' in settings) {
        const s = settings as {
          id: string;
          medicalSpecialty?: string | null;
          nationalLicenseNumber?: string | null;
          stateLicense?: string | null;
          stateLicenseNumber?: string | null;
        };
        mdSettingsRecord = {
          id: s.id,
          medicalSpecialty: s.medicalSpecialty ?? null,
          nationalLicenseNumber: s.nationalLicenseNumber ?? null,
          stateLicense: s.stateLicense ?? null,
          stateLicenseNumber: s.stateLicenseNumber ?? null,
        };
      } else {
        const mdResponse = await client.service('md-settings').find({
          query: { userId: user.id },
          paginate: false,
        });
        const list = normalizeArray<MdSettingsProfile>(mdResponse);
        const first = list[0];
        if (first) {
          mdSettingsRecord = {
            id: first.id,
            medicalSpecialty: first.medicalSpecialty ?? null,
            nationalLicenseNumber: first.nationalLicenseNumber ?? null,
            stateLicense: first.stateLicense ?? null,
            stateLicenseNumber: first.stateLicenseNumber ?? null,
          };
        }
      }
    }
    let passkeys: { id: string; deviceName: string | null; createdAt: string }[] = [];
    try {
      const credentialsResponse = await client.service('passkey-credentials').find({
        query: { $sort: { createdAt: -1 } },
      });
      const credentialsList = Array.isArray(credentialsResponse)
        ? credentialsResponse
        : (credentialsResponse as any)?.data || [];
      passkeys = credentialsList.map((c: any) => ({
        id: c.id,
        deviceName: c.deviceName,
        createdAt: c.createdAt,
      }));
    } catch {
      // passkey-credentials table may not exist yet
    }

    return json({
      username: user.username,
      twoFactorEnabled: Boolean(profile.twoFactorEnabled),
      user: fullUser,
      isMedic,
      mdSettings: mdSettingsRecord,
      passkeys,
    });
  } catch (error) {
    throw redirect('/login');
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');
  let client: Application;
  try {
    const authenticated = await getAuthenticatedClient(request);
    client = authenticated.client;
  } catch (error) {
    throw redirect('/login');
  }

  try {
    if (intent === 'setup-2fa') {
      const result = await client.service('profile').create({ action: 'setup-2fa' });
      const setup = await buildTwoFactorSetupPayload(result);
      return json({ ok: true, intent, result: setup });
    }

    if (intent === 'enable-2fa') {
      const twoFactorCode = String(formData.get('twoFactorCode') || '');
      const result = await client.service('profile').create({ action: 'enable-2fa', twoFactorCode });
      return json({ ok: true, intent, result });
    }

    if (intent === 'change-password') {
      const currentPassword = String(formData.get('currentPassword') || '');
      const newPassword = String(formData.get('newPassword') || '');
      const twoFactorCode = String(formData.get('twoFactorCode') || '');

      const result = await client.service('profile').create({
        action: 'change-password',
        currentPassword,
        newPassword,
        twoFactorCode,
      });

      return json({ ok: true, intent, result });
    }

    if (intent === 'passkey-register-options') {
      const result = await client.service('webauthn').create({
        action: 'generate-registration-options',
      });
      return json({ ok: true, intent, result });
    }

    if (intent === 'passkey-register-verify') {
      const credential = JSON.parse(String(formData.get('credential') || '{}'));
      const deviceName = String(formData.get('deviceName') || '');
      const result = await client.service('webauthn').create({
        action: 'verify-registration',
        credential,
        deviceName,
      });
      return json({ ok: true, intent, result });
    }

    if (intent === 'passkey-remove') {
      const passkeyId = String(formData.get('passkeyId') || '');
      await client.service('passkey-credentials').remove(passkeyId);
      return json({ ok: true, intent });
    }

    if (intent === 'update-profile') {
      const payloadRaw = String(formData.get('payload') || '{}');
      const payload = JSON.parse(payloadRaw) as {
        personalData?: Record<string, unknown>;
        contactData?: Record<string, unknown>;
        mdSettings?: Record<string, unknown>;
      };
      await client.service('profile').create({
        action: 'update-profile',
        personalData: payload.personalData,
        contactData: payload.contactData,
        mdSettings: payload.mdSettings,
      });
      return json({ ok: true, intent });
    }

    return json({ ok: false, intent, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return json(
      {
        ok: false,
        intent,
        error: error?.message || 'Operation failed',
      },
      { status: 400 }
    );
  }
};

function buildSelectOptions(obj: Record<string, string>) {
  return Object.entries(obj).map(([value, label]) => ({ value, label }));
}

export default function Profile() {
  const { username, twoFactorEnabled, user, isMedic, mdSettings, passkeys } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const { t } = useTranslation();

  const isSavingProfile = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'update-profile';
  const countryOptions = useMemo(
    () => buildSelectOptions(t('countries', { returnObjects: true }) as Record<string, string>),
    [t]
  );
  const provinceOptions = useMemo(
    () => buildSelectOptions(t('provinces', { returnObjects: true }) as Record<string, string>),
    [t]
  );

  const [activeTab, setActiveTab] = useState<string | null>('profile');
  const hasEnableSuccess = actionData?.ok && actionData.intent === 'enable-2fa';
  const hasProfileSuccess = actionData?.ok && actionData.intent === 'update-profile';
  const hasPasskeyChange =
    actionData?.ok && (actionData.intent === 'passkey-register-verify' || actionData.intent === 'passkey-remove');

  useEffect(() => {
    if (hasEnableSuccess) {
      revalidator.revalidate();
    }
  }, [hasEnableSuccess, revalidator]);

  useEffect(() => {
    if (hasProfileSuccess) {
      revalidator.revalidate();
    }
  }, [hasProfileSuccess, revalidator]);

  useEffect(() => {
    if (hasPasskeyChange) {
      revalidator.revalidate();
    }
  }, [hasPasskeyChange, revalidator]);

  const profileTabListClass = css({
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--mantine-spacing-xl)',
  });

  const profileTabClass = css({
    padding: '0.5em 0',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    color: 'var(--mantine-color-gray-6)',
    cursor: 'pointer',
    fontSize: 'inherit',
    fontWeight: 500,
    transition: 'color 0.15s ease, border-color 0.15s ease',

    '&:hover': {
      color: 'var(--mantine-color-gray-8)',
    },

    '&[data-active]': {
      color: 'var(--mantine-color-blue-6)',
      borderBottomColor: 'var(--mantine-color-blue-6)',
    },
  });

  return (
    <FormContainer style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="unstyled"
        classNames={{ list: profileTabListClass, tab: profileTabClass }}
      >
        <Portal id="toolbar">
          <Tabs.List>
            <Tabs.Tab value="profile">{t('profile.tab_profile')}</Tabs.Tab>
            <Tabs.Tab value="security">{t('profile.tab_security')}</Tabs.Tab>
          </Tabs.List>
        </Portal>

        <Tabs.Panel value="profile" pt="md">
          <ProfileForm
            user={user}
            mdSettings={mdSettings}
            isMedic={isMedic}
            actionData={actionData}
            countryOptions={countryOptions}
            provinceOptions={provinceOptions}
            isSavingProfile={isSavingProfile}
            showFormActions={activeTab === 'profile'}
          />
        </Tabs.Panel>
        <Tabs.Panel value="security" pt="md">
          <ProfileSecurity
            username={username}
            twoFactorEnabled={twoFactorEnabled}
            actionData={actionData}
            passkeys={passkeys}
            showFormActions={activeTab === 'security'}
          />
        </Tabs.Panel>
      </Tabs>
    </FormContainer>
  );
}
