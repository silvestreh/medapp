import { useCallback, useEffect, useState } from 'react';
import { useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { ActionIcon, Button, Group, Popover, Text, Tooltip } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { XIcon } from '@phosphor-icons/react';

import type { MemberRow } from './types';

interface RemoveConfirmPopoverProps {
  member: MemberRow;
  disabled: boolean;
}

export function RemoveConfirmPopover({ member, disabled }: RemoveConfirmPopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.ok) {
        showNotification({ color: 'teal', message: t('users.remove_member_success') });
        setOpened(false);
      } else {
        showNotification({ color: 'red', message: fetcher.data.error || t('users.remove_member_error') });
      }
    }
  }, [fetcher.state, fetcher.data, t]);

  const handleConfirm = useCallback(() => {
    fetcher.submit({ intent: 'remove-member', membershipId: member.id }, { method: 'post' });
  }, [fetcher, member.id]);

  return (
    <Popover opened={opened} onChange={setOpened} position="left" shadow="md" withinPortal withArrow>
      <Popover.Target>
        <Tooltip label={t('users.remove_member')} position="left">
          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setOpened(o => !o)} disabled={disabled}>
            <XIcon size={14} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p="sm" maw={400}>
        <Text size="sm" mb="sm">
          {t('users.remove_member_confirm', { username: member.user?.username ?? '—' })}
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button size="compact-sm" variant="default" onClick={() => setOpened(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="compact-sm" color="red" loading={fetcher.state !== 'idle'} onClick={handleConfirm}>
            {t('users.remove_member')}
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}
