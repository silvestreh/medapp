import React, { cloneElement, isValidElement, type ReactElement } from 'react';
import { Button, Flex, Tooltip, Image, type DefaultMantineColor } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { NavLink, useMatches } from '@remix-run/react';
import { Calendar, User, Stethoscope, FlaskConical, Shield, type LucideProps } from 'lucide-react';

import { styled } from '~/styled-system/jsx';
import { media } from '~/media';
import HasPermission from '~/components/has-permission';

type Section = {
  label: string;
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

const NavItem = styled(Button, {
  base: {
    '&.mantine-Button-root': {
      borderRadius: '8px',
      textAlign: 'left',
      justifyContent: 'flex-start',
      width: '3.5em',
      height: '3.5em',
      padding: 0,

      sm: {
        width: '2.75em',
        height: '2.75em',
      },
    },
    '&:not(.active):hover': {
      backgroundColor: 'var(--mantine-color-blue-0) !important',
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
        backgroundColor: 'var(--mantine-color-lime-6) !important',
        color: 'white !important',
      },
    },
    {
      tone: 'indigo',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-indigo-6) !important',
        color: 'white !important',
      },
    },
    {
      tone: 'pink',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-pink-6) !important',
        color: 'white !important',
      },
    },
    {
      tone: 'yellow',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-yellow-5) !important',
        color: 'var(--mantine-color-dark-7) !important',
      },
    },
    {
      tone: 'red',
      active: true,
      css: {
        backgroundColor: 'var(--mantine-color-red-6) !important',
        color: 'white !important',
      },
    },
  ],
}) as unknown as typeof Button;

const Logo = styled(Image, {
  base: {
    aspectRatio: '1',
    maxWidth: '3em',
    sm: {
      display: 'none !important',
    },
    md: {
      display: 'block !important',
    },
  },
}) as unknown as typeof Image;

const sections: Section[] = [
  {
    label: 'Encuentros',
    icon: <Stethoscope />,
    permissions: ['encounters:create', 'encounters:find', 'encounters:get'],
    path: '/encounters',
    color: 'lime',
  },
  {
    label: 'Estudios',
    icon: <FlaskConical />,
    permissions: ['studies:create', 'studies:find', 'studies:get'],
    path: '/studies',
    color: 'indigo',
  },
  {
    label: 'Turnos',
    icon: <Calendar />,
    permissions: ['appointments:create', 'appointments:find', 'appointments:get'],
    path: '/appointments',
    color: 'pink',
  },
  {
    label: 'Pacientes',
    icon: <User />,
    permissions: ['patients:create', 'patients:find', 'patients:get'],
    path: '/patients',
    color: 'yellow',
  },
  {
    label: 'Usuarios & Roles',
    icon: <Shield />,
    permissions: ['users:create', 'users:find', 'users:get', 'roles:find', 'roles:get', 'roles:patch'],
    path: '/users',
    color: 'red',
  },
];

const SideNav: React.FC = () => {
  const matches = useMatches();
  const isMobile = useMediaQuery(media.sm);

  return (
    <Container>
      <StickyContent>
        <Logo src="/logo.webp" alt="Logo" />
        {sections.map((section: Section) => {
          const isActive = matches.at(-1)?.pathname.startsWith(section.path);

          return (
            <HasPermission key={section.label} permissions={section.permissions}>
              <Tooltip label={section.label} position="right">
                <NavItem
                  tone={section.color}
                  active={isActive}
                  component={NavLink}
                  prefetch="intent"
                  to={isActive ? '#' : section.path}
                  variant="subtle"
                  className={isActive ? 'active' : ''}
                  bg={isActive ? section.color : 'transparent'}
                  color={isActive ? 'white' : 'gray'}
                >
                  {isValidElement(section.icon) &&
                    cloneElement(section.icon as ReactElement<LucideProps>, { size: isMobile ? 18 : 22 })}
                </NavItem>
              </Tooltip>
            </HasPermission>
          );
        })}
      </StickyContent>
    </Container>
  );
};

export default SideNav;
