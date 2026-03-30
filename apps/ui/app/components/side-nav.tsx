import React, { cloneElement, isValidElement, useCallback, useMemo, type ReactElement } from 'react';
import { ActionIcon, Flex, Tooltip, Image, Menu, type DefaultMantineColor } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { NavLink, useLocation, useMatches, useNavigate } from '@remix-run/react';
import {
  CalendarIcon,
  UserIcon,
  StethoscopeIcon,
  FlaskIcon,
  ClipboardTextIcon,
  ShieldIcon,
  TranslateIcon,
  ChartBarIcon,
  CalculatorIcon,
  ChatCircleIcon,
  ShieldCheckIcon,
  DotsThreeIcon,
  type IconProps,
} from '@phosphor-icons/react';
import intersection from 'lodash/intersection';
import { useTranslation } from 'react-i18next';

import { styled } from '~/styled-system/jsx';
import { media } from '~/media';
import { useAccount, useOrganization } from '~/components/provider';
import HasPermission from '~/components/has-permission';
import { UserListPopover } from '~/components/chat/user-list-popover';
import HelpButton from '~/components/guided-tour/help-button';

type Section = {
  labelKey: string;
  icon: React.ReactNode;
  path: string;
  permissions: string[];
  color: DefaultMantineColor;
};

const Container = styled(Flex, {
  base: {
    backgroundColor: 'var(--mantine-color-body)',

    '&:empty': {
      display: 'none',
    },
    sm: {
      justifyContent: 'space-around',
      borderTop: '1px solid var(--mantine-color-gray-2)',
      borderRight: 'none',
      position: 'sticky',
      bottom: 0,
      zIndex: 2,
      gap: 0,
    },
    md: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      borderRight: '1px solid var(--mantine-color-gray-2)',
      borderTop: 'none',
    },
  },
});

const StickyContent = styled(Flex, {
  base: {
    '&:empty': {
      display: 'none',
    },

    sm: {
      justifyContent: 'space-around',
      position: 'sticky',
      padding: '0.75em',
      bottom: 0,
      zIndex: 1,
      flexGrow: 1,
      gap: 0,
    },

    md: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '1em',
      bottom: 'unset',
      top: 0,
      flexGrow: 0,
      gap: '1em',
    },
  },
});

const NavItem = styled(ActionIcon, {
  base: {
    borderRadius: '8px',
    color: 'var(--mantine-color-gray-6)',

    '&:not(.active):hover': {
      backgroundColor: 'var(--mantine-primary-color-0)',
    },
  },
  variants: {
    tone: {
      lime: {},
      indigo: {},
      pink: {},
      yellow: {},
      red: {},
      teal: {},
    },
    active: {
      true: {},
      false: {},
    },
  },
  compoundVariants: [
    {
      tone: 'lime',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-lime-6)',
        color: 'white',
      },
    },
    {
      tone: 'indigo',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-indigo-6)',
        color: 'white',
      },
    },
    {
      tone: 'pink',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-pink-6)',
        color: 'white',
      },
    },
    {
      tone: 'yellow',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-yellow-5)',
        color: 'var(--mantine-color-dark-7)',
      },
    },
    {
      tone: 'red',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-red-6)',
        color: 'white',
      },
    },
    {
      tone: 'teal',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-teal-6)',
        color: 'white',
      },
    },
  ],
}) as any;

const Logo = styled(Image, {
  base: {
    aspectRatio: '1',
    maxWidth: '3em',
    sm: {
      display: 'none',
    },
    md: {
      display: 'block',
    },
  },
}) as unknown as typeof Image;

const LanguageSwitcherContainer = styled(Flex, {
  base: {
    sm: {
      display: 'none',
    },
    md: {
      display: 'flex',
      width: '100%',
      justifyContent: 'center',
      marginTop: 'auto',
      padding: '0.75em 1em 1em',
      position: 'sticky',
      bottom: 0,
      flexDirection: 'column',
    },
  },
});

const MobileOnly = styled('div', {
  base: {
    sm: {
      display: 'contents',
    },
    md: {
      display: 'none',
    },
  },
});

const DesktopOnly = styled('div', {
  base: {
    sm: {
      display: 'none',
    },
    md: {
      display: 'contents',
    },
  },
});

const sections: Section[] = [
  {
    labelKey: 'encounters',
    icon: <StethoscopeIcon />,
    permissions: ['encounters:create', 'encounters:find', 'encounters:get'],
    path: '/encounters',
    color: 'lime',
  },
  {
    labelKey: 'studies',
    icon: <FlaskIcon />,
    permissions: ['studies:create', 'studies:find', 'studies:get'],
    path: '/studies',
    color: 'indigo',
  },
  {
    labelKey: 'appointments',
    icon: <CalendarIcon />,
    permissions: ['appointments:create'],
    path: '/appointments',
    color: 'pink',
  },
  {
    labelKey: 'patients',
    icon: <UserIcon />,
    permissions: ['patients:create', 'patients:find', 'patients:get'],
    path: '/patients',
    color: 'yellow',
  },
  {
    labelKey: 'prescriptions',
    icon: <ClipboardTextIcon />,
    permissions: ['recetario:create', 'prescriptions:find'],
    path: '/prescriptions',
    color: 'teal',
  },
  {
    labelKey: 'users_roles',
    icon: <ShieldIcon />,
    permissions: ['roles:find', 'roles:get', 'roles:patch'],
    path: '/users',
    color: 'red',
  },
  {
    labelKey: 'accounting',
    icon: <CalculatorIcon />,
    permissions: ['accounting:find'],
    path: '/accounting',
    color: 'indigo',
  },
  {
    labelKey: 'stats',
    icon: <ChartBarIcon />,
    permissions: ['stats:find:all'],
    path: '/stats',
    color: 'teal',
  },
];

const OVERFLOW_KEYS = new Set(['users_roles', 'accounting']);

const SideNav: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAccount();
  const { currentOrganizationId } = useOrganization();
  const matches = useMatches();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = !useMediaQuery(media.md);
  const currentLanguage = i18n.resolvedLanguage || 'es';

  const handleLanguageChange = useCallback(
    (lng: string) => () => {
      if (currentLanguage === lng) {
        return;
      }

      const params = new URLSearchParams(location.search);
      params.set('lng', lng);
      navigate(`${location.pathname}?${params.toString()}`, { replace: true, preventScrollReset: true });
    },
    [currentLanguage, location.search, location.pathname, navigate]
  );

  const visibleSections = useMemo(() => {
    if (!user) return [];
    const currentOrg = (user as any).organizations?.find((o: any) => o.id === currentOrganizationId);
    const orgPermissions: string[] = currentOrg?.permissions ?? [];
    return sections.filter(s => intersection(s.permissions, orgPermissions).length > 0);
  }, [user, currentOrganizationId]);

  const shouldOverflow = visibleSections.length > 4;

  const overflowSections = useMemo(
    () => (shouldOverflow ? visibleSections.filter(s => OVERFLOW_KEYS.has(s.labelKey)) : []),
    [shouldOverflow, visibleSections]
  );

  const renderSection = useCallback(
    (section: Section) => {
      const isActive = matches.at(-1)?.pathname.startsWith(section.path);
      const label = t(`navigation.${section.labelKey}` as any);
      const isOverflow = shouldOverflow && OVERFLOW_KEYS.has(section.labelKey);

      const item = (
        <HasPermission permissions={section.permissions}>
          <Tooltip label={label} position="right">
            <NavItem
              tone={section.color}
              active={isActive}
              component={NavLink}
              prefetch="intent"
              to={section.path}
              variant="subtle"
              size="3em"
              className={isActive ? 'active' : ''}
            >
              {isValidElement(section.icon) &&
                cloneElement(section.icon as ReactElement<IconProps>, { size: isMobile ? 18 : 22 })}
            </NavItem>
          </Tooltip>
        </HasPermission>
      );

      if (isOverflow) {
        return <DesktopOnly key={section.labelKey}>{item}</DesktopOnly>;
      }

      return <React.Fragment key={section.labelKey}>{item}</React.Fragment>;
    },
    [matches, t, isMobile, shouldOverflow]
  );

  return (
    <Container>
      <StickyContent>
        <Logo src="/logo.webp" alt="Logo" />
        {user && sections.map(renderSection)}
        {user &&
          (user as any).isSuperAdmin &&
          (() => {
            const isAdminActive = matches.at(-1)?.pathname.startsWith('/admin');
            return (
              <Tooltip label={t('navigation.admin', 'Admin')} position="right">
                <NavItem
                  tone="red"
                  active={isAdminActive}
                  component={NavLink}
                  prefetch="intent"
                  to="/admin"
                  variant="subtle"
                  size="3em"
                  className={isAdminActive ? 'active' : ''}
                >
                  <ShieldCheckIcon size={isMobile ? 18 : 22} />
                </NavItem>
              </Tooltip>
            );
          })()}
        {user && (
          <MobileOnly>
            <Menu withArrow position="top" shadow="xs">
              <Menu.Target>
                <Tooltip label={t('navigation.more', 'More')} position="right">
                  <ActionIcon variant="subtle" size="3em">
                    <DotsThreeIcon size={18} weight="bold" />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                {overflowSections.map(section => {
                  const isActive = matches.at(-1)?.pathname.startsWith(section.path);
                  return (
                    <Menu.Item
                      key={section.labelKey}
                      leftSection={
                        isValidElement(section.icon)
                          ? cloneElement(section.icon as ReactElement<IconProps>, { size: 16 })
                          : undefined
                      }
                      component={NavLink}
                      to={section.path}
                      prefetch="intent"
                      bg={isActive ? `var(--mantine-color-${section.color}-0)` : undefined}
                    >
                      {t(`navigation.${section.labelKey}` as any)}
                    </Menu.Item>
                  );
                })}
                {overflowSections.length > 0 && <Menu.Divider />}
                <HelpButton asMenuItem />
                <Menu.Divider />
                <Menu.Label>{t('navigation.language')}</Menu.Label>
                <Menu.Item onClick={handleLanguageChange('es')} disabled={currentLanguage === 'es'}>
                  {t('common.spanish')}
                </Menu.Item>
                <Menu.Item onClick={handleLanguageChange('en')} disabled={currentLanguage === 'en'}>
                  {t('common.english')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </MobileOnly>
        )}
      </StickyContent>
      <LanguageSwitcherContainer>
        {user && (
          <UserListPopover>
            <Tooltip label={t('navigation.chat', 'Chat')} position="right">
              <ActionIcon variant="subtle" size="3em">
                <ChatCircleIcon size={isMobile ? 18 : 22} />
              </ActionIcon>
            </Tooltip>
          </UserListPopover>
        )}
        {user && <HelpButton />}
        <Menu withArrow position={isMobile ? 'right-end' : 'right-end'} shadow="xs">
          <Menu.Target>
            <Tooltip label={t('navigation.language')} position="right">
              <ActionIcon variant="subtle" size="3em">
                <TranslateIcon size={isMobile ? 18 : 22} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={handleLanguageChange('es')} disabled={currentLanguage === 'es'}>
              {t('common.spanish')}
            </Menu.Item>
            <Menu.Item onClick={handleLanguageChange('en')} disabled={currentLanguage === 'en'}>
              {t('common.english')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </LanguageSwitcherContainer>
    </Container>
  );
};

export default SideNav;
