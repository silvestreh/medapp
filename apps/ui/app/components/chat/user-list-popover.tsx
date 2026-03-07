import { useCallback, useMemo } from 'react';
import { Avatar, Box, Group, Popover, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { useChat, type OrgUser } from '~/components/chat/chat-provider';
import { useChatManager, deterministicColor } from '~/components/chat-manager';
import { useAccount } from '~/components/provider';

const STATUS_COLORS: Record<string, string> = {
  online: 'var(--mantine-color-green-6)',
  away: 'var(--mantine-color-yellow-5)',
  dnd: 'var(--mantine-color-red-6)',
  offline: 'var(--mantine-color-gray-5)',
};

const STATUS_ORDER: Record<string, number> = {
  online: 0,
  away: 1,
  dnd: 2,
  offline: 3,
};

export function UserListPopover({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { chatClient, orgUsers, getStatus, getStatusText } = useChat();
  const { openMessagingChat } = useChatManager();
  const { user } = useAccount();

  const sortedUsers = useMemo(() => {
    return [...orgUsers].sort((a, b) => {
      const sa = STATUS_ORDER[getStatus(a.userId)] ?? 3;
      const sb = STATUS_ORDER[getStatus(b.userId)] ?? 3;
      if (sa !== sb) return sa - sb;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [orgUsers, getStatus]);

  const handleUserClick = useCallback(
    async (orgUser: OrgUser) => {
      console.log('[UserListPopover] clicked user:', orgUser.fullName, '— chatClient:', !!chatClient, 'user:', user?.id ?? 'null');
      if (!chatClient || !user?.id) {
        console.warn('[UserListPopover] BAILING — chatClient is', chatClient, ', user.id is', user?.id);
        return;
      }
      close();

      try {
        const response = await chatClient.service('conversations').find({
          query: { $limit: 50 },
        });
        const conversations = Array.isArray(response) ? response : (response as any)?.data ?? [];

        let conversation = conversations.find((c: any) => {
          const participants: any[] = c.participants || [];
          if (participants.length !== 2) return false;
          const ids = participants.map((p: any) => p.userId);
          return ids.includes(user.id) && ids.includes(orgUser.userId);
        });

        if (!conversation) {
          conversation = await chatClient.service('conversations').create({
            participantIds: [user.id, orgUser.userId],
          });
        }

        const myInitials = `${(user.personalData as Record<string, string>)?.firstName?.[0] ?? ''}${(user.personalData as Record<string, string>)?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

        openMessagingChat({
          conversationId: conversation.id,
          userId: orgUser.userId,
          name: orgUser.fullName,
          initials: orgUser.initials,
          participants: [
            { userId: user.id, name: 'You', initials: myInitials },
            { userId: orgUser.userId, name: orgUser.fullName, initials: orgUser.initials },
          ],
        });
      } catch (err) {
        console.warn('[Chat] Failed to open conversation:', err);
      }
    },
    [chatClient, user, openMessagingChat, close]
  );

  return (
    <Popover opened={opened} onChange={toggle} position="right-end" shadow="md" withArrow width={280}>
      <Popover.Target>
        <Box onClick={toggle} style={{ cursor: 'pointer' }}>
          {children}
        </Box>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <ScrollArea.Autosize mah={400}>
          <Stack gap={0}>
            {sortedUsers.map(orgUser => {
              const status = getStatus(orgUser.userId);
              const statusText = getStatusText(orgUser.userId);
              const color = deterministicColor(orgUser.userId);

              return (
                <UnstyledButton
                  key={orgUser.userId}
                  onClick={() => handleUserClick(orgUser)}
                  px="md"
                  py="sm"
                  style={{
                    borderBottom: '1px solid var(--mantine-color-gray-1)',
                    '&:hover': { backgroundColor: 'var(--mantine-color-gray-0)' },
                  }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Box style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar size={36} radius="xl" color={color}>
                        {orgUser.initials}
                      </Avatar>
                      <Box
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.offline,
                          border: '2px solid white',
                        }}
                      />
                    </Box>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={500} lineClamp={1}>
                        {orgUser.fullName}
                      </Text>
                      {statusText && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {statusText}
                        </Text>
                      )}
                    </Box>
                  </Group>
                </UnstyledButton>
              );
            })}
            {sortedUsers.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="lg">
                No users found
              </Text>
            )}
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
