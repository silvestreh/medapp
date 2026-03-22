import type { LoaderFunctionArgs } from '@remix-run/node';
import { NavLink as RemixNavLink, Outlet } from '@remix-run/react';
import { Flex, NavLink, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { requireAuth } from '~/utils/auth.server';
import { styled } from '~/styled-system/jsx';
import { docsManifest } from '~/lib/docs-manifest';
import RouteErrorFallback from '~/components/route-error-fallback';

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

    lg: {
      flexDirection: 'column',
      padding: 'var(--mantine-spacing-xl)',
      minW: '16rem',
      position: 'sticky',
      top: '5rem',
      alignSelf: 'flex-start',
      maxWidth: 'unset',
      overflow: 'unset',
      borderBottom: 'none',
    },
  },
});

const ContentContainer = styled('div', {
  base: {
    flex: 1,
    maxWidth: '800px',
    margin: '0 auto',
    padding: 'var(--mantine-spacing-md)',
    width: '100%',

    lg: {
      padding: 'var(--mantine-spacing-xl)',
    },
  },
});

const navLinkStyle = { borderRadius: 'var(--mantine-radius-md)', flex: 'none' } as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAuth(request);
  return null;
};

function DocsSidebar() {
  const { t } = useTranslation();

  return (
    <NavContainer>
      {docsManifest.map(section => (
        <div key={section.titleKey}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" mt="sm" px="sm" hiddenFrom="lg">
            {t(section.titleKey as any)}
          </Text>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" mt="sm" px="sm" visibleFrom="lg">
            {t(section.titleKey as any)}
          </Text>
          {section.pages.map(page => (
            <NavLink
              key={page.slug}
              component={RemixNavLink}
              to={`/docs/${page.slug}`}
              label={t(page.titleKey as any)}
              variant="light"
              style={navLinkStyle}
            />
          ))}
        </div>
      ))}
    </NavContainer>
  );
}

export default function DocsLayout() {
  return (
    <Flex direction={{ base: 'column', lg: 'row' }}>
      <DocsSidebar />
      <ContentContainer>
        <Outlet />
      </ContentContainer>
    </Flex>
  );
}

export const ErrorBoundary = RouteErrorFallback;
