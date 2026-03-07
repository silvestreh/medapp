import { useCallback, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Popover,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Circle, LogOut, Users } from 'lucide-react';

import { useChat, type OrgUser } from '~/components/chat/chat-provider';
import { useChatManager, deterministicColor, type ChatParticipant } from '~/components/chat-manager';
import { useAccount } from '~/components/provider';

const STATUS_COLORS: Record<string, string> = {
  online: 'var(--mantine-color-green-6)',
  away: 'var(--mantine-color-yellow-5)',
  dnd: 'var(--mantine-color-red-6)',
  offline: 'var(--mantine-color-gray-5)',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  away: 'Away',
  dnd: 'Do not disturb',
  offline: 'Offline',
};

const STATUS_ORDER: Record<string, number> = {
  online: 0,
  away: 1,
  dnd: 2,
  offline: 3,
};

export function UserListPopover({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const {
    chatClient,
    orgUsers,
    conversations,
    getStatus,
    getStatusText,
    myStatus,
    setMyStatus,
    leaveConversation,
    refreshConversations,
  } = useChat();
  const { openMessagingChat, closeChat } = useChatManager();
  const { user } = useAccount();
  const [groupMode, setGroupMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const sortedUsers = useMemo(() => {
    return [...orgUsers].sort((a, b) => {
      const sa = STATUS_ORDER[getStatus(a.userId)] ?? 3;
      const sb = STATUS_ORDER[getStatus(b.userId)] ?? 3;
      if (sa !== sb) return sa - sb;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [orgUsers, getStatus]);

  // Group conversations (3+ participants)
  const groupConversations = useMemo(() => {
    if (!user?.id) return [];
    return conversations.filter(c => (c.participants?.length ?? 0) > 2);
  }, [conversations, user?.id]);

  const handleToggleUser = useCallback((userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleUserClick = useCallback(
    async (orgUser: OrgUser) => {
      if (!chatClient || !user?.id) return;
      close();

      try {
        const response = await chatClient.service('conversations').find({
          query: { $limit: 50 },
        });
        const allConversations = Array.isArray(response) ? response : ((response as any)?.data ?? []);

        let conversation = allConversations.find((c: any) => {
          const participants: any[] = c.participants || [];
          if (participants.length !== 2) return false;
          const ids = participants.map((p: any) => p.userId);
          return ids.includes(user.id) && ids.includes(orgUser.userId);
        });

        if (!conversation) {
          conversation = await chatClient.service('conversations').create({
            participantIds: [user.id, orgUser.userId],
          });
          refreshConversations();
        }

        const myInitials =
          `${(user.personalData as Record<string, string>)?.firstName?.[0] ?? ''}${(user.personalData as Record<string, string>)?.lastName?.[0] ?? ''}`.toUpperCase() ||
          '?';

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
    [chatClient, user, openMessagingChat, close, refreshConversations]
  );

  const handleGroupClick = useCallback(
    (conversationId: string, participants: ChatParticipant[]) => {
      if (!user?.id) return;
      close();

      const others = participants.filter(p => p.userId !== user.id);
      const groupName = `Group: ${others.map(p => p.initials).join(', ')}`;

      openMessagingChat({
        conversationId,
        userId: others[0]?.userId ?? '',
        name: groupName,
        initials: 'G',
        participants,
      });
    },
    [user, openMessagingChat, close]
  );

  const handleLeaveGroup = useCallback(
    async (conversationId: string) => {
      await leaveConversation(conversationId);
      // Also close the chat head if open
      closeChat(`msg-${conversationId}`);
    },
    [leaveConversation, closeChat]
  );

  const handleCreateGroup = useCallback(async () => {
    if (!chatClient || !user?.id || selectedUserIds.size < 2) return;
    close();

    try {
      const participantIds = [user.id, ...selectedUserIds];
      const conversation = await chatClient.service('conversations').create({ participantIds });

      const myInitials =
        `${(user.personalData as Record<string, string>)?.firstName?.[0] ?? ''}${(user.personalData as Record<string, string>)?.lastName?.[0] ?? ''}`.toUpperCase() ||
        '?';
      const myName =
        `${(user.personalData as Record<string, string>)?.firstName ?? ''} ${(user.personalData as Record<string, string>)?.lastName ?? ''}`.trim() ||
        'You';

      const participants = [
        { userId: user.id, name: myName, initials: myInitials },
        ...orgUsers
          .filter(u => selectedUserIds.has(u.userId))
          .map(u => ({ userId: u.userId, name: u.fullName, initials: u.initials })),
      ];

      const groupName = participants
        .filter(p => p.userId !== user.id)
        .map(p => p.initials)
        .join(', ');

      openMessagingChat({
        conversationId: conversation.id,
        userId: [...selectedUserIds][0],
        name: `Group: ${groupName}`,
        initials: 'G',
        participants,
      });

      refreshConversations();
      setGroupMode(false);
      setSelectedUserIds(new Set());
    } catch (err) {
      console.warn('[Chat] Failed to create group:', err);
    }
  }, [chatClient, user, selectedUserIds, orgUsers, openMessagingChat, close, refreshConversations]);

  const handleToggleGroupMode = useCallback(() => {
    setGroupMode(prev => !prev);
    setSelectedUserIds(new Set());
  }, []);

  const handleStatusChange = useCallback(
    (status: 'online' | 'away' | 'dnd' | 'offline') => {
      setMyStatus(status);
    },
    [setMyStatus]
  );

  const handlePopoverChange = useCallback(() => {
    toggle();
    if (opened) {
      setGroupMode(false);
      setSelectedUserIds(new Set());
    }
  }, [toggle, opened]);

  // Resolve participant names from orgUsers
  const resolveParticipants = useCallback(
    (rawParticipants: Array<{ userId: string }>): ChatParticipant[] => {
      return rawParticipants.map(p => {
        const orgUser = orgUsers.find(u => u.userId === p.userId);
        if (orgUser) {
          return { userId: p.userId, name: orgUser.fullName, initials: orgUser.initials };
        }
        if (p.userId === user?.id) {
          const pd = user?.personalData as Record<string, string>;
          const initials = `${pd?.firstName?.[0] ?? ''}${pd?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
          return { userId: p.userId, name: 'You', initials };
        }
        return { userId: p.userId, name: p.userId, initials: '?' };
      });
    },
    [orgUsers, user]
  );

  return (
    <Popover opened={opened} onChange={handlePopoverChange} position="right-end" shadow="md" withArrow width={280}>
      <Popover.Target>
        <Box onClick={handlePopoverChange} style={{ cursor: 'pointer' }}>
          {children}
        </Box>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Stack gap={0} style={{ maxHeight: 440, display: 'flex', flexDirection: 'column' }}>
          {/* Sticky header */}
          <Box px="md" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}>
            <Group justify="space-between" align="center">
              <Menu shadow="md" width={180}>
                <Menu.Target>
                  <UnstyledButton>
                    <Group gap={6}>
                      <Circle size={10} fill={STATUS_COLORS[myStatus]} color={STATUS_COLORS[myStatus]} />
                      <Text size="sm" fw={500}>
                        {STATUS_LABELS[myStatus]}
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                  {(['online', 'away', 'dnd', 'offline'] as const).map(s => (
                    <Menu.Item
                      key={s}
                      leftSection={<Circle size={10} fill={STATUS_COLORS[s]} color={STATUS_COLORS[s]} />}
                      onClick={() => handleStatusChange(s)}
                    >
                      {STATUS_LABELS[s]}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
              <UnstyledButton onClick={handleToggleGroupMode}>
                <Group gap={4}>
                  <Users size={14} color={groupMode ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-6)'} />
                  <Text size="xs" c={groupMode ? 'blue' : 'dimmed'}>
                    {groupMode ? 'Cancel' : 'New group'}
                  </Text>
                </Group>
              </UnstyledButton>
            </Group>
          </Box>

          {/* User list + group conversations */}
          <ScrollArea.Autosize mah={340} style={{ flex: 1 }}>
            <Stack gap={0}>
              {sortedUsers.map(orgUser => {
                const status = getStatus(orgUser.userId);
                const statusText = getStatusText(orgUser.userId);
                const color = deterministicColor(orgUser.userId);
                const isSelected = selectedUserIds.has(orgUser.userId);

                return (
                  <UnstyledButton
                    key={orgUser.userId}
                    onClick={() => (groupMode ? handleToggleUser(orgUser.userId) : handleUserClick(orgUser))}
                    px="md"
                    py="sm"
                    style={{
                      borderBottom: '1px solid var(--mantine-color-gray-1)',
                      backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
                    }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      {groupMode && (
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleUser(orgUser.userId)}
                          size="sm"
                          style={{ flexShrink: 0 }}
                          tabIndex={-1}
                        />
                      )}
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

              {/* Group conversations section */}
              {!groupMode && groupConversations.length > 0 && (
                <>
                  <Box px="md" py="xs" bg="gray.0">
                    <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                      Groups
                    </Text>
                  </Box>
                  {groupConversations.map(conv => {
                    const participants = resolveParticipants(conv.participants);
                    const others = participants.filter(p => p.userId !== user?.id);
                    const color = deterministicColor(conv.id);

                    return (
                      <UnstyledButton
                        key={conv.id}
                        onClick={() => handleGroupClick(conv.id, participants)}
                        px="md"
                        py="sm"
                        style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}
                      >
                        <Group gap="sm" wrap="nowrap" justify="space-between">
                          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                            <Avatar size={36} radius="xl" color={color}>
                              <Users size={18} />
                            </Avatar>
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={500} lineClamp={1}>
                                {others.map(p => p.name).join(', ')}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {participants.length} members
                              </Text>
                            </Box>
                          </Group>
                          <UnstyledButton
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleLeaveGroup(conv.id);
                            }}
                            style={{ flexShrink: 0 }}
                          >
                            <LogOut size={14} color="var(--mantine-color-red-6)" />
                          </UnstyledButton>
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </>
              )}

              {sortedUsers.length === 0 && groupConversations.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  No users found
                </Text>
              )}
            </Stack>
          </ScrollArea.Autosize>

          {/* Sticky bottom: Create group button */}
          {groupMode && selectedUserIds.size >= 2 && (
            <Box px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}>
              <Button fullWidth onClick={handleCreateGroup}>
                Create group ({selectedUserIds.size})
              </Button>
            </Box>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
