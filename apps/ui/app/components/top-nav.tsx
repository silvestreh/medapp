import { useCallback, useMemo } from 'react';
import { Avatar, Group, Image, Menu, UnstyledButton, Text } from '@mantine/core';
import { Link, useLocation } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { BuildingsIcon, CaretDownIcon, CheckIcon, SignOutIcon, UserIcon } from '@phosphor-icons/react';

import { styled } from '~/styled-system/jsx';
import { useAccount, useOrganization } from '~/components/provider';
import { deterministicColor } from '~/components/chat-manager';
import { Account } from '~/declarations';
import { trackAction } from '~/utils/breadcrumbs';

const Logo = styled(Image, {
  base: {
    aspectRatio: '1',
    width: '2.25em',

    sm: {
      display: 'block !important',
    },
    md: {
      display: 'none !important',
    },
  },
}) as unknown as typeof Image;

const Toolbar = styled(Group, {
  base: {
    alignItems: 'center',
    flex: 1,
  },
});

const FormActions = styled(Group, {
  base: {
    alignItems: 'center',

    '&:empty': {
      display: 'none',
    },
  },
});

const Container = styled('div', {
  base: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1em',
    backgroundColor: 'var(--mantine-color-body)',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    width: '100%',
    position: 'sticky',
    padding: '1em',
    top: 0,
    zIndex: 10,

    '&:empty': {
      display: 'none',
    },

    md: {
      padding: '1em',
    },
    lg: {
      padding: '1.25em',
    },
  },
});

const TriggerButton = styled(UnstyledButton, {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35em',
    padding: '0.25em 0.5em 0.25em 0.25em',
    borderRadius: '999px',
    cursor: 'pointer',
    transition: 'background-color 100ms ease',

    '&:hover': {
      backgroundColor: 'var(--mantine-color-gray-1)',
    },
  },
});

function getInitials(user: Account): string {
  const { firstName, lastName } = user.personalData || { firstName: '', lastName: '' };
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  return initials || '?';
}

export default function TopNav() {
  const { t } = useTranslation();
  const { user, logout } = useAccount();
  const { organizations, currentOrganizationId, switchOrganization } = useOrganization();

  const currentOrg = useMemo(
    () => organizations.find(o => o.id === currentOrganizationId),
    [organizations, currentOrganizationId]
  );

  const hasMultipleOrgs = organizations.length > 1;

  const initials = useMemo(() => (user ? getInitials(user) : '?'), [user]);
  const avatarColor = useMemo(() => (user ? deterministicColor(user.id) : 'var(--mantine-primary-color-0)'), [user]);

  const handleSwitch = useCallback(
    (id: string) => () => {
      if (id !== currentOrganizationId) {
        trackAction('Switched organization', { organizationId: id });
        switchOrganization(id);
      }
    },
    [currentOrganizationId, switchOrganization]
  );

  const handleLogout = useCallback(() => {
    trackAction('User logged out');
    logout();
  }, [logout]);

  const { pathname } = useLocation();
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup');

  if (!user || isAuthRoute) return <Container />;

  return (
    <Container>
      <Logo src="/logo.webp" alt="Logo" />
      <Toolbar id="toolbar" />
      <FormActions id="form-actions" />

      <Menu withArrow position="bottom-end" shadow="md" width={220}>
        <Menu.Target>
          <div data-tour="user-menu">
            <TriggerButton>
              <Avatar size={32} radius="xl" color={avatarColor}>
                {initials}
              </Avatar>
              <CaretDownIcon size={14} color="var(--mantine-color-gray-5)" />
            </TriggerButton>
          </div>
        </Menu.Target>

        <Menu.Dropdown>
          {!hasMultipleOrgs && currentOrg && (
            <>
              <Menu.Item leftSection={<BuildingsIcon size={14} />} disabled style={{ opacity: 1 }}>
                <Text size="sm" fw={500}>
                  {currentOrg.name}
                </Text>
              </Menu.Item>
              <Menu.Divider />
            </>
          )}

          {hasMultipleOrgs && (
            <>
              <Menu.Label>{t('navigation.organization')}</Menu.Label>
              {organizations.map(org => (
                <Menu.Item
                  key={org.id}
                  rightSection={org.id === currentOrganizationId ? <CheckIcon size={14} /> : null}
                  onClick={handleSwitch(org.id)}
                >
                  <Text size="sm" fw={org.id === currentOrganizationId ? 600 : 400}>
                    {org.name}
                  </Text>
                </Menu.Item>
              ))}
              <Menu.Divider />
            </>
          )}

          <Menu.Item leftSection={<UserIcon size={14} />} component={Link} to="/settings">
            {t('navigation.settings')}
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item leftSection={<SignOutIcon size={14} />} color="red" onClick={handleLogout}>
            {t('navigation.logout')}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Container>
  );
}
