import { useCallback, useEffect, useRef, useState } from 'react';
import { useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { Badge, Checkbox, Group, Popover, Stack, UnstyledButton } from '@mantine/core';
import { showNotification } from '@mantine/notifications';

import { ROLE_COLORS } from './types';

interface RoleMultiSelectProps {
  value: string[];
  allRoles: { id: string; label: string }[];
  userId: string;
  isCurrentUser: boolean;
}

export function RoleMultiSelect({ value, allRoles, userId, isCurrentUser }: RoleMultiSelectProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const pending = fetcher.state !== 'idle';
  const latestValue = useRef(value);
  latestValue.current = value;

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.ok) {
        showNotification({ color: 'teal', message: t('users.roles_updated') });
      } else {
        showNotification({ color: 'red', message: fetcher.data.error || t('users.roles_update_error') });
      }
    }
  }, [fetcher.state, fetcher.data, t]);

  const handleToggle = useCallback(
    (roleId: string) => {
      if (roleId === 'owner') return;

      const current = latestValue.current;
      let next: string[];

      if (current.includes(roleId)) {
        next = current.filter(r => r !== roleId);
      } else {
        next = [...current, roleId];
      }

      if (next.length === 0) {
        showNotification({ color: 'orange', message: t('users.min_one_role') });
        return;
      }

      fetcher.submit({ intent: 'update-roles', userId, roleIds: JSON.stringify(next) }, { method: 'post' });
    },
    [userId, t, fetcher]
  );

  const badges = value.map(roleId => {
    const color = ROLE_COLORS[roleId] ?? 'gray';
    const label = allRoles.find(r => r.id === roleId)?.label ?? roleId;
    return (
      <Badge key={roleId} color={color} variant="light" size="sm">
        {label}
      </Badge>
    );
  });

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <UnstyledButton onClick={() => setOpened(o => !o)}>
          <Group gap={4} wrap="wrap">
            {badges.length > 0 ? (
              badges
            ) : (
              <Badge color="gray" variant="light" size="sm">
                —
              </Badge>
            )}
          </Group>
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown p="xs">
        <Stack gap={6}>
          {allRoles.map(role => {
            const isSelected = value.includes(role.id);
            const isLastSelected = isSelected && value.length === 1;
            const isOwnerRole = role.id === 'owner';
            const locked = isOwnerRole || (isCurrentUser && isLastSelected);
            return (
              <Checkbox
                key={role.id}
                label={
                  <Badge color={ROLE_COLORS[role.id] ?? 'gray'} variant={isSelected ? 'filled' : 'light'} size="sm">
                    {role.label}
                  </Badge>
                }
                checked={isSelected}
                disabled={pending || locked || isLastSelected}
                onChange={() => handleToggle(role.id)}
                styles={{ body: { alignItems: 'center' } }}
              />
            );
          })}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
