import React, { useCallback, useMemo } from 'react';
import { Menu, UnstyledButton, Text, Group } from '@mantine/core';
import { BuildingsIcon, CaretDownIcon, CheckIcon } from '@phosphor-icons/react';

import { styled } from '~/styled-system/jsx';
import { useOrganization } from '~/components/provider';
import { trackAction } from '~/utils/breadcrumbs';

const SwitcherButton = styled(UnstyledButton, {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5em',
    padding: '0.4em 0.75em',
    borderRadius: '8px',
    border: '1px solid var(--mantine-color-gray-3)',
    backgroundColor: 'white',
    cursor: 'pointer',
    transition: 'background-color 100ms ease',
    maxWidth: '220px',

    '&:hover': {
      backgroundColor: 'var(--mantine-color-gray-0)',
    },
  },
});

const OrgName = styled(Text, {
  base: {
    fontWeight: 500,
    fontSize: '0.875rem',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

const OrganizationSwitcher: React.FC = () => {
  const { organizations, currentOrganizationId, switchOrganization } = useOrganization();

  const currentOrg = useMemo(
    () => organizations.find(o => o.id === currentOrganizationId),
    [organizations, currentOrganizationId]
  );

  const handleSwitch = useCallback(
    (id: string) => () => {
      if (id !== currentOrganizationId) {
        trackAction('Switched organization', { organizationId: id });
        switchOrganization(id);
      }
    },
    [currentOrganizationId, switchOrganization]
  );

  if (organizations.length === 0) {
    return null;
  }

  if (organizations.length === 1) {
    return (
      <Group gap="0.5em">
        <BuildingsIcon size={16} color="var(--mantine-color-gray-6)" />
        <OrgName>{currentOrg?.name}</OrgName>
      </Group>
    );
  }

  return (
    <Menu withArrow position="bottom-start" shadow="md">
      <Menu.Target>
        <SwitcherButton>
          <BuildingsIcon size={16} color="var(--mantine-color-gray-6)" />
          <OrgName>{currentOrg?.name ?? 'Select organization'}</OrgName>
          <CaretDownIcon size={14} color="var(--mantine-color-gray-5)" />
        </SwitcherButton>
      </Menu.Target>
      <Menu.Dropdown>
        {organizations.map(org => (
          <Menu.Item
            key={org.id}
            onClick={handleSwitch(org.id)}
            rightSection={org.id === currentOrganizationId ? <CheckIcon size={14} /> : null}
          >
            <Text size="sm" fw={org.id === currentOrganizationId ? 600 : 400}>
              {org.name}
            </Text>
            <Text size="xs" c="dimmed">
              {org.roleIds.join(', ')}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
};

export default OrganizationSwitcher;
