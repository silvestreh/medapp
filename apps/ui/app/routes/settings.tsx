import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { NavLink as RemixNavLink, Outlet, useLoaderData, useRouteLoaderData } from '@remix-run/react';
import { Flex, NavLink } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  UserIcon,
  ShieldIcon,
  PenNibIcon,
  BuildingsIcon,
  FileTextIcon,
  RobotIcon,
  CreditCardIcon,
  WhatsappLogoIcon,
} from '@phosphor-icons/react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import { FormContainer } from '~/components/forms/styles';
import RouteErrorFallback from '~/components/route-error-fallback';
import { styled } from '~/styled-system/jsx';

type MdSettingsProfile = {
  id: string;
  medicalSpecialty: string | null;
  nationalLicenseNumber: string | null;
  stateLicense: string | null;
  stateLicenseNumber: string | null;
  isVerified: boolean;
  recetarioTitle: string | null;
  recetarioProvince: string | null;
  signatureImage: string | null;
};

const NavContainer = styled('div', {
  base: {
    padding: 'var(--mantine-spacing-md)',
    display: 'flex',
    gap: 'var(--mantine-spacing-xs)',
    maxWidth: '100vw',
    overflowY: 'hidden',
    overflowX: 'auto',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    scrollbarWidth: 'none',

    '& .mantine-NavLink-root': {
      flex: 'none',
      width: 'auto',

      lg: {
        flex: 1,
      },
    },

    '& + .settings-container': {
      padding: 'var(--mantine-spacing-md)',

      lg: {
        padding: 'var(--mantine-spacing-xl)',
      },
    },

    lg: {
      flexDirection: 'column',
      padding: 'var(--mantine-spacing-xl)',
      minW: '20rem',
      position: 'sticky',
      top: '5rem',
      alignSelf: 'flex-start',
      maxWidth: 'unset',
      overflow: 'unset',
      borderBottom: 'none',
    },
  },
});

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'data' in value) {
    const data = (value as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

export const meta: MetaFunction = () => {
  return [{ title: 'Settings | Athelas' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { client, user } = await getAuthenticatedClient(request);
    const profile = await client.service('profile').get('me');
    const fullUser = await client.service('users').get(user.id);
    const currentOrganizationId = await getCurrentOrganizationId(request);
    const orgs = (fullUser as any).organizations as
      | Array<{ id: string; name: string; slug: string; isActive: boolean; roleIds: string[]; permissions: string[] }>
      | undefined;
    const currentMembership = orgs?.find(o => o.id === currentOrganizationId);
    const currentOrgRoleIds = currentMembership?.roleIds || [];
    const isMedic = currentOrgRoleIds.includes('medic');
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
          recetarioTitle?: string | null;
          recetarioProvince?: string | null;
          signatureImage?: string | null;
        };
        mdSettingsRecord = {
          id: s.id,
          medicalSpecialty: s.medicalSpecialty ?? null,
          nationalLicenseNumber: s.nationalLicenseNumber ?? null,
          stateLicense: s.stateLicense ?? null,
          stateLicenseNumber: s.stateLicenseNumber ?? null,
          isVerified: s.isVerified ?? false,
          recetarioTitle: s.recetarioTitle ?? null,
          recetarioProvince: s.recetarioProvince ?? null,
          signatureImage: s.signatureImage ?? null,
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
            recetarioTitle: (first as any).recetarioTitle ?? null,
            recetarioProvince: (first as any).recetarioProvince ?? null,
            signatureImage: (first as any).signatureImage ?? null,
          };
        }
      }
    }
    let identityVerification: {
      status: 'pending' | 'verified' | 'rejected';
      rejectionReason: string | null;
      autoCheckCompletedAt: string | null;
      autoCheckProgress: { step: string; current: number | null; total: number | null; position: number | null } | null;
      dniScanData: {
        tramiteNumber: string;
        lastName: string;
        firstName: string;
        gender: string;
        dniNumber: string;
        exemplar: string;
        birthDate: string;
        issueDate: string;
      } | null;
    } | null = null;
    if (isMedic) {
      try {
        const ivResponse = await client.service('identity-verifications' as any).find({
          query: { $sort: { createdAt: -1 }, $limit: 1 },
        });
        const ivList = Array.isArray(ivResponse) ? ivResponse : (ivResponse as any)?.data || [];
        if (ivList.length > 0) {
          identityVerification = {
            status: ivList[0].status,
            rejectionReason: ivList[0].rejectionReason || null,
            autoCheckCompletedAt: ivList[0].autoCheckCompletedAt || null,
            autoCheckProgress: ivList[0].autoCheckProgress || null,
            dniScanData: ivList[0].dniScanData || null,
          };
        }
      } catch {
        // identity-verifications table may not exist yet
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

    let signingCertificate: {
      id: string;
      fileName: string | null;
      isClientEncrypted?: boolean;
      createdAt: string;
    } | null = null;
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

    const canManageOrg =
      currentMembership?.roleIds?.includes('owner') || currentMembership?.roleIds?.includes('admin') || false;
    let isOrgOwner = false;
    let currentOrg: {
      id: string;
      name: string;
      slug: string;
      settings?: Record<string, any>;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      logoUrl?: string | null;
    } | null = null;
    if (canManageOrg) {
      isOrgOwner = true;
      try {
        const org = await client.service('organizations').get(currentMembership.id);
        currentOrg = {
          id: org.id,
          name: org.name,
          slug: org.slug,
          settings: (org as any)?.settings || {},
          address: (org as any)?.settings?.healthCenter?.address || null,
          phone: (org as any)?.settings?.healthCenter?.phone || null,
          email: (org as any)?.settings?.healthCenter?.email || null,
          logoUrl: (org as any)?.settings?.healthCenter?.logoUrl || null,
        };
      } catch {
        currentOrg = {
          id: currentMembership.id,
          name: currentMembership.name,
          slug: currentMembership.slug,
          settings: {},
        };
      }
    }

    return json({
      username: user.username,
      twoFactorEnabled: Boolean(profile.twoFactorEnabled),
      user: fullUser,
      isMedic,
      mdSettings: mdSettingsRecord,
      identityVerification,
      passkeys,
      isOrgOwner,
      currentOrg,
      signingCertificate,
    });
  } catch (error) {
    throw redirect('/login');
  }
};

const navLinkStyle = { borderRadius: 'var(--mantine-radius-md)', flex: 'none' } as const;

function SettingsTabs({ isMedic, isOrgOwner }: { isMedic: boolean; isOrgOwner: boolean }) {
  const { t } = useTranslation();

  return (
    <NavContainer>
      <NavLink
        component={RemixNavLink}
        to="/settings"
        end
        label={t('profile.tab_profile')}
        leftSection={<UserIcon size={16} />}
        variant="light"
        style={navLinkStyle}
      />
      <NavLink
        component={RemixNavLink}
        to="/settings/security"
        label={t('profile.tab_security')}
        leftSection={<ShieldIcon size={16} />}
        variant="light"
        style={navLinkStyle}
      />
      {isMedic && (
        <NavLink
          component={RemixNavLink}
          to="/settings/id-verification"
          label={t('profile.tab_id_verification')}
          leftSection={<CreditCardIcon size={16} />}
          variant="light"
          style={navLinkStyle}
        />
      )}
      {isMedic && (
        <NavLink
          component={RemixNavLink}
          to="/settings/signature"
          label={t('profile.tab_signature')}
          leftSection={<PenNibIcon size={16} />}
          variant="light"
          style={navLinkStyle}
        />
      )}
      {isOrgOwner && (
        <NavLink
          component={RemixNavLink}
          to="/settings/organization"
          label={t('profile.tab_organization')}
          leftSection={<BuildingsIcon size={16} />}
          variant="light"
          style={navLinkStyle}
        />
      )}
      {isOrgOwner && (
        <NavLink
          component={RemixNavLink}
          to="/settings/whatsapp"
          label={t('profile.tab_whatsapp')}
          leftSection={<WhatsappLogoIcon size={16} />}
          variant="light"
          style={navLinkStyle}
        />
      )}
      {isOrgOwner && (
        <NavLink
          component={RemixNavLink}
          to="/settings/prescriptions"
          label={t('profile.tab_prescriptions')}
          leftSection={<FileTextIcon size={16} />}
          variant="light"
          style={navLinkStyle}
        />
      )}
      {isOrgOwner && (
        <NavLink
          component={RemixNavLink}
          to="/settings/assistant"
          label={t('profile.tab_assistant')}
          leftSection={<RobotIcon size={16} />}
          variant="light"
          style={navLinkStyle}
        />
      )}
    </NavContainer>
  );
}

export default function SettingsLayout() {
  const { isMedic, isOrgOwner } = useLoaderData<typeof loader>();

  return (
    <Flex direction={{ base: 'column', lg: 'row' }}>
      <SettingsTabs isMedic={isMedic} isOrgOwner={isOrgOwner} />
      <FormContainer className="settings-container" styles={{ root: { maxWidth: 720, margin: '0 auto' } }}>
        <div style={{ paddingTop: 'var(--mantine-spacing-md)' }}>
          <Outlet />
        </div>
      </FormContainer>
    </Flex>
  );
}

export function ErrorBoundary() {
  const data = useRouteLoaderData<typeof loader>('routes/settings');

  return (
    <FormContainer style={{ maxWidth: 720, margin: '0 auto' }}>
      {data && <SettingsTabs isMedic={data.isMedic} isOrgOwner={data.isOrgOwner} />}

      <div style={{ paddingTop: 'var(--mantine-spacing-md)' }}>
        <RouteErrorFallback />
      </div>
    </FormContainer>
  );
}
