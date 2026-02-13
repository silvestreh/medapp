import React, { cloneElement, isValidElement, type ReactElement } from 'react';
import { ActionIcon, Flex, Tooltip, Image, Menu, type DefaultMantineColor } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { NavLink, useLocation, useMatches, useNavigate } from '@remix-run/react';
import { Calendar, User, Stethoscope, FlaskConical, Shield, Languages, type LucideProps } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { styled } from '~/styled-system/jsx';
import { media } from '~/media';
import HasPermission from '~/components/has-permission';

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
      zIndex: 1,
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
    gap: '1em',

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
    },
    md: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '1em',
      bottom: 'unset',
      top: 0,
      flexGrow: 0,
    },
  },
});

const NavItem = styled(ActionIcon, {
  base: {
    borderRadius: '8px',
    color: 'var(--mantine-color-gray-6)',

    '&:not(.active):hover': {
      backgroundColor: 'var(--mantine-color-blue-0)',
    },
  },
  variants: {
    tone: {
      lime: {},
      indigo: {},
      pink: {},
      yellow: {},
      red: {},
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
      alignItems: 'center',
      padding: '0.75em',
    },
    md: {
      width: '100%',
      justifyContent: 'center',
      marginTop: 'auto',
      padding: '0.75em 1em 1em',
      position: 'sticky',
      bottom: 0,
    },
  },
});

const sections: Section[] = [
  {
    labelKey: 'encounters',
    icon: <Stethoscope />,
    permissions: ['encounters:create', 'encounters:find', 'encounters:get'],
    path: '/encounters',
    color: 'lime',
  },
  {
    labelKey: 'studies',
    icon: <FlaskConical />,
    permissions: ['studies:create', 'studies:find', 'studies:get'],
    path: '/studies',
    color: 'indigo',
  },
  {
    labelKey: 'appointments',
    icon: <Calendar />,
    permissions: ['appointments:create', 'appointments:find', 'appointments:get'],
    path: '/appointments',
    color: 'pink',
  },
  {
    labelKey: 'patients',
    icon: <User />,
    permissions: ['patients:create', 'patients:find', 'patients:get'],
    path: '/patients',
    color: 'yellow',
  },
  {
    labelKey: 'users_roles',
    icon: <Shield />,
    permissions: ['users:create', 'users:find', 'users:get', 'roles:find', 'roles:get', 'roles:patch'],
    path: '/users',
    color: 'red',
  },
];

const SideNav: React.FC = () => {
  const { t, i18n } = useTranslation();
  const matches = useMatches();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(media.sm);
  const currentLanguage = i18n.resolvedLanguage || 'es';

  const handleLanguageChange = (lng: string) => () => {
    if (currentLanguage === lng) {
      return;
    }

    const params = new URLSearchParams(location.search);
    params.set('lng', lng);
    navigate(`${location.pathname}?${params.toString()}`, { replace: true, preventScrollReset: true });
  };

  return (
    <Container>
      <StickyContent>
        <Logo src="/logo.webp" alt="Logo" />
        {sections.map((section: Section) => {
          const isActive = matches.at(-1)?.pathname.startsWith(section.path);
          const label = t(`navigation.${section.labelKey}` as any);

          return (
            <HasPermission key={section.labelKey} permissions={section.permissions}>
              <Tooltip label={label} position="right">
                <NavItem
                  tone={section.color}
                  active={isActive}
                  component={NavLink}
                  prefetch="intent"
                  to={isActive ? '#' : section.path}
                  variant="subtle"
                  size="3em"
                  className={isActive ? 'active' : ''}
                >
                  {isValidElement(section.icon) &&
                    cloneElement(section.icon as ReactElement<LucideProps>, { size: isMobile ? 18 : 22 })}
                </NavItem>
              </Tooltip>
            </HasPermission>
          );
        })}
      </StickyContent>
      <LanguageSwitcherContainer>
        <Menu withArrow position={isMobile ? 'top-end' : 'right-end'} shadow="xs">
          <Menu.Target>
            <Tooltip label={t('navigation.language')} position={isMobile ? 'top' : 'right'}>
              <ActionIcon variant="subtle" size="3em">
                <Languages size={isMobile ? 18 : 22} />
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
