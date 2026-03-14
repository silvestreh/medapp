import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { NavLink as RemixNavLink, Outlet, useLoaderData } from '@remix-run/react';
import { Flex, NavLink } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon, ScrollIcon, BuildingsIcon } from '@phosphor-icons/react';

import { getAuthenticatedClient } from '~/utils/auth.server';
import { FormContainer } from '~/components/forms/styles';
import RouteErrorFallback from '~/components/route-error-fallback';
import { styled } from '~/styled-system/jsx';

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

    '& + .admin-container': {
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

export const meta: MetaFunction = () => {
  return [{ title: 'Admin | Athelas' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { client, user } = await getAuthenticatedClient(request);
    const fullUser = await client.service('users').get(user.id);

    if (!(fullUser as any).isSuperAdmin) {
      throw redirect('/');
    }

    return json({ user: fullUser });
  } catch (error: any) {
    if (error?.status === 302 || error?.statusCode === 302) throw error;
    throw redirect('/login');
  }
};

const navLinkStyle = { borderRadius: 'var(--mantine-radius-md)', flex: 'none' } as const;

function AdminTabs() {
  const { t } = useTranslation();

  return (
    <NavContainer>
      <NavLink
        component={RemixNavLink}
        to="/admin"
        end
        label={t('admin.tab_verifications')}
        leftSection={<ShieldCheckIcon size={16} />}
        variant="light"
        style={navLinkStyle}
      />
      <NavLink
        component={RemixNavLink}
        to="/admin/logs"
        label={t('admin.tab_access_logs')}
        leftSection={<ScrollIcon size={16} />}
        variant="light"
        style={navLinkStyle}
      />
      <NavLink
        component={RemixNavLink}
        to="/admin/organizations"
        label={t('admin.tab_organizations')}
        leftSection={<BuildingsIcon size={16} />}
        variant="light"
        style={navLinkStyle}
      />
    </NavContainer>
  );
}

export default function AdminLayout() {
  return (
    <Flex direction={{ base: 'column', lg: 'row' }}>
      <AdminTabs />
      <FormContainer className="admin-container" styles={{ root: { maxWidth: 960, margin: '0 auto', flex: 1 } }}>
        <div style={{ paddingTop: 'var(--mantine-spacing-md)' }}>
          <Outlet />
        </div>
      </FormContainer>
    </Flex>
  );
}

export function ErrorBoundary() {
  return (
    <FormContainer style={{ maxWidth: 960, margin: '0 auto' }}>
      <AdminTabs />
      <div style={{ paddingTop: 'var(--mantine-spacing-md)' }}>
        <RouteErrorFallback />
      </div>
    </FormContainer>
  );
}
