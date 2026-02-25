import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { NavLink, Outlet, useLoaderData } from '@remix-run/react';
import { useTranslation } from 'react-i18next';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { FormContainer } from '~/components/forms/styles';
import Portal from '~/components/portal';
import { css } from '~/styled-system/css';

type MdSettingsProfile = {
  id: string;
  medicalSpecialty: string | null;
  nationalLicenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
  isVerified: boolean;
};

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

export const meta: MetaFunction = () => {
  return [{ title: 'Profile | MedApp' }];
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
          isVerified?: boolean;
        };
        mdSettingsRecord = {
          id: s.id,
          medicalSpecialty: s.medicalSpecialty ?? null,
          nationalLicenseNumber: s.nationalLicenseNumber ?? null,
          stateLicense: s.stateLicense ?? null,
          stateLicenseNumber: s.stateLicenseNumber ?? null,
          isVerified: s.isVerified ?? false,
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
            isVerified: (first as any).isVerified ?? false,
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

    let signingCertificate: { id: string; fileName: string | null; isClientEncrypted?: boolean; createdAt: string } | null = null;
    if (isMedic) {
      try {
        const certResponse = await client.service('signing-certificates' as any).find({
          query: { $limit: 1 },
        });
        const certs = Array.isArray(certResponse) ? certResponse : (certResponse as any)?.data || [];
        if (certs.length > 0) {
          signingCertificate = {
            id: certs[0].id,
            fileName: certs[0].fileName,
            isClientEncrypted: !!certs[0].isClientEncrypted,
            createdAt: certs[0].createdAt,
          };
        }
      } catch {
        // signing-certificates table may not exist yet
      }
    }

    let isOrgOwner = false;
    let currentOrg: { id: string; name: string; slug: string } | null = null;
    const currentOrganizationId = await getCurrentOrganizationId(request);
    const orgs = (fullUser as any).organizations as
      | Array<{ id: string; name: string; slug: string; role: string }>
      | undefined;
    if (orgs?.length && currentOrganizationId) {
      const membership = orgs.find(o => o.id === currentOrganizationId);
      if (membership?.role === 'owner') {
        isOrgOwner = true;
        currentOrg = { id: membership.id, name: membership.name, slug: membership.slug };
      }
    }

    return json({
      username: user.username,
      twoFactorEnabled: Boolean(profile.twoFactorEnabled),
      user: fullUser,
      isMedic,
      mdSettings: mdSettingsRecord,
      passkeys,
      isOrgOwner,
      currentOrg,
      signingCertificate,
    });
  } catch (error) {
    throw redirect('/login');
  }
};

const tabListClass = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--mantine-spacing-xl)',
});

const tabLinkClass = css({
  padding: '0.5em 0',
  border: 'none',
  background: 'transparent',
  color: 'var(--mantine-color-gray-6)',
  cursor: 'pointer',
  fontSize: 'inherit',
  fontWeight: 500,
  transition: 'color 0.15s ease, border-color 0.15s ease',
  textDecoration: 'none',
  position: 'relative',

  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-1.5em',
    bottom: 0,
    left: 0,
    width: '100%',
    height: 'calc(100% + 3em)',
    backgroundColor: 'transparent',
  },

  '&:hover': {
    color: 'var(--mantine-color-gray-8)',
  },
});

const activeIndicatorClass = css({
  position: 'absolute',
  top: 'calc(100% + 1.125em)',
  left: 0,
  width: '100%',
  height: '2px',
  backgroundColor: 'var(--mantine-color-blue-6)',
  pointerEvents: 'none',
});

function TabLink({ to, end, children }: { to: string; end?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={tabLinkClass}
      style={({ isActive }) => (isActive ? { color: 'var(--mantine-color-blue-6)' } : {})}
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive && <span className={activeIndicatorClass} />}
        </>
      )}
    </NavLink>
  );
}

export default function ProfileLayout() {
  const { isMedic, isOrgOwner } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  return (
    <FormContainer style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <Portal id="toolbar">
        <nav className={tabListClass}>
          <TabLink to="/profile" end>
            {t('profile.tab_profile')}
          </TabLink>
          <TabLink to="/profile/security">{t('profile.tab_security')}</TabLink>
          {isMedic && <TabLink to="/profile/signature">{t('profile.tab_signature')}</TabLink>}
          {isOrgOwner && <TabLink to="/profile/organization">{t('profile.tab_organization')}</TabLink>}
        </nav>
      </Portal>

      <div style={{ paddingTop: 'var(--mantine-spacing-md)' }}>
        <Outlet />
      </div>
    </FormContainer>
  );
}
