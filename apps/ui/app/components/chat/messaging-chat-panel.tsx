import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Avatar,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ArrowDownRight, UserPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useChat, type OrgUser } from '~/components/chat/chat-provider';
import { useAccount } from '~/components/provider';
import { media } from '~/media';
import { deterministicColor, type ChatParticipant } from '~/components/chat-manager';
import { useChatManager } from '~/components/chat-manager';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: string;
}

export interface MessagingChatPanelProps {
  chatKey: string;
  conversationId: string;
  participants?: ChatParticipant[];
  accentColor: string;
  isActive: boolean;
  onMinimize: () => void;
  onClose: () => void;
}

const PAGE_SIZE = 25;

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function ParticipantAvatars({
  participants,
  currentUserId,
}: {
  participants: ChatParticipant[];
  currentUserId: string;
}) {
  const others = participants.filter(p => p.userId !== currentUserId);
  const size = 24;
  const overlap = 8;

  return (
    <ScrollArea
      scrollbarSize={0}
      style={{ flexShrink: 1, minWidth: 0 }}
      type="scroll"
    >
      <Group gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Text size="sm" fw={600} c="white" style={{ whiteSpace: 'nowrap', marginRight: 8 }}>
          Group:
        </Text>
        <Box
          style={{
            display: 'flex',
            position: 'relative',
            height: size,
            width: size + (others.length - 1) * (size - overlap),
            flexShrink: 0,
          }}
        >
          {others.map((p, idx) => (
            <Avatar
              key={p.userId}
              size={size}
              radius="xl"
              color="white"
              variant="filled"
              style={{
                position: 'absolute',
                left: idx * (size - overlap),
                zIndex: others.length - idx,
                border: '2px solid rgba(255,255,255,0.4)',
                fontSize: 10,
              }}
            >
              {p.initials}
            </Avatar>
          ))}
        </Box>
      </Group>
    </ScrollArea>
  );
}

export function MessagingChatPanel({
  chatKey,
  conversationId,
  participants,
  accentColor,
  isActive,
  onMinimize,
  onClose,
}: MessagingChatPanelProps) {
  const { t } = useTranslation();
  const { chatClient, orgUsers } = useChat();
  const { user } = useAccount();
  const { updateChatParticipants } = useChatManager();
  const isDesktop = useMediaQuery(media.md);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isPrependingRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserQuery, setAddUserQuery] = useState('');
  const loadedRef = useRef(false);
  const addUserInputRef = useRef<HTMLInputElement | null>(null);

  const isGroup = (participants?.length ?? 0) > 2;
  const recipientName = useMemo(() => {
    if (!participants || participants.length === 0) return '';
    if (isGroup) return '';
    const other = participants.find(p => p.userId !== user?.id);
    return other?.name ?? '';
  }, [participants, isGroup, user?.id]);

  // Load initial messages
  useEffect(() => {
    if (!chatClient || !conversationId || !isActive || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const response = await chatClient.service('messages').find({
          query: {
            conversationId,
            $sort: { createdAt: -1 },
            $limit: PAGE_SIZE,
          },
        });
        if (cancelled) return;

        const items: Message[] = Array.isArray(response)
          ? response
          : (response as any)?.data ?? [];
        setMessages(items.slice().reverse());
        setHasMore(items.length === PAGE_SIZE);
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatClient, conversationId, isActive]);

  // Real-time message listener
  useEffect(() => {
    if (!chatClient) return;

    const handleCreated = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const service = chatClient.service('messages');
    service.on('created', handleCreated);
    return () => {
      service.removeListener('created', handleCreated);
    };
  }, [chatClient, conversationId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!isActive || isPrependingRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isActive, messages]);

  const handleLoadOlder = useCallback(async () => {
    if (!chatClient || !hasMore || isLoadingOlder || messages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const prevHeight = container.scrollHeight;
    const prevTop = container.scrollTop;
    setIsLoadingOlder(true);

    try {
      const oldest = messages[0];
      const response = await chatClient.service('messages').find({
        query: {
          conversationId,
          $sort: { createdAt: -1 },
          $limit: PAGE_SIZE,
          createdAt: { $lt: oldest.createdAt },
        },
      });

      const items: Message[] = Array.isArray(response)
        ? response
        : (response as any)?.data ?? [];

      if (items.length === 0) {
        setHasMore(false);
        return;
      }

      isPrependingRef.current = true;
      setMessages(prev => [...items.slice().reverse(), ...prev]);
      setHasMore(items.length === PAGE_SIZE);

      window.requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight - prevHeight + prevTop;
        }
        isPrependingRef.current = false;
      });
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingOlder(false);
    }
  }, [chatClient, conversationId, hasMore, isLoadingOlder, messages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || container.scrollTop > 40) return;
    handleLoadOlder();
  }, [handleLoadOlder]);

  const handleSend = useCallback(async () => {
    const content = draftMessage.trim();
    if (!content || !chatClient || isSending) return;

    setIsSending(true);
    setDraftMessage('');
    try {
      await chatClient.service('messages').create({
        conversationId,
        content,
      });
    } catch (err) {
      console.warn('[Chat] Failed to send message:', err);
      setDraftMessage(content);
    } finally {
      setIsSending(false);
    }
  }, [chatClient, conversationId, draftMessage, isSending]);

  const handleDraftChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftMessage(e.currentTarget.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      handleSend();
    },
    [handleSend]
  );

  // Add user autocomplete data
  const addUserOptions = useMemo(() => {
    const currentIds = new Set(participants?.map(p => p.userId) ?? []);
    return orgUsers
      .filter(u => !currentIds.has(u.userId))
      .filter(u => {
        if (!addUserQuery) return true;
        const q = addUserQuery.toLowerCase();
        return u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
      })
      .map(u => ({ value: u.fullName, userId: u.userId, user: u }));
  }, [orgUsers, participants, addUserQuery]);

  const handleToggleAddUser = useCallback(() => {
    setShowAddUser(prev => !prev);
    setAddUserQuery('');
  }, []);

  // Focus input when add user opens
  useEffect(() => {
    if (showAddUser) {
      setTimeout(() => addUserInputRef.current?.focus(), 50);
    }
  }, [showAddUser]);

  const handleAddUser = useCallback(
    async (fullName: string) => {
      const match = orgUsers.find(u => u.fullName === fullName);
      if (!match || !chatClient || !user?.id) return;

      try {
        await chatClient.service('conversation-participants').create({
          conversationId,
          userId: match.userId,
        });

        const newParticipant: ChatParticipant = {
          userId: match.userId,
          name: match.fullName,
          initials: match.initials,
        };
        const updated = [...(participants ?? []), newParticipant];
        const groupName =
          'Group: ' +
          updated
            .filter(p => p.userId !== user.id)
            .map(p => p.initials)
            .join(', ');
        updateChatParticipants(chatKey, updated, groupName);

        setShowAddUser(false);
        setAddUserQuery('');
      } catch (err) {
        console.warn('[Chat] Failed to add participant:', err);
      }
    },
    [chatClient, conversationId, orgUsers, participants, user?.id, chatKey, updateChatParticipants]
  );

  const senderNames = useMemo(() => {
    const map = new Map<string, { name: string; initials: string; color: string }>();
    orgUsers.forEach(u => {
      map.set(u.userId, {
        name: u.fullName,
        initials: u.initials,
        color: deterministicColor(u.userId),
      });
    });
    if (user) {
      map.set(user.id, {
        name: t('ai_chat.you'),
        initials:
          `${(user.personalData as Record<string, string>)?.firstName?.[0] ?? ''}${(user.personalData as Record<string, string>)?.lastName?.[0] ?? ''}`.toUpperCase() ||
          '?',
        color: 'blue',
      });
    }
    return map;
  }, [orgUsers, user, t]);

  if (!isDesktop) return null;

  return (
    <Paper
      withBorder
      radius="md"
      style={{
        width: 'min(380px, calc(100vw - 6rem))',
        height: 'min(60vh, 560px)',
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.075), 0 8px 32px rgba(0,0,0,0.075), 0 24px 48px rgba(0,0,0,0.075)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'white',
      }}
    >
      {/* Header */}
      <Group
        justify="space-between"
        align="center"
        px="md"
        py="sm"
        bg={`${accentColor}.5`}
        style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}
      >
        {isGroup && participants ? (
          <ParticipantAvatars participants={participants} currentUserId={user?.id ?? ''} />
        ) : (
          <Text fw={600} c="white" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
            {recipientName}
          </Text>
        )}
        <Group gap={4} style={{ flexShrink: 0 }}>
          <ActionIcon variant="subtle" color="white" onClick={handleToggleAddUser}>
            <UserPlus size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="white" onClick={onMinimize}>
            <ArrowDownRight size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="white" onClick={onClose}>
            <X size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Add user autocomplete */}
      {showAddUser && (
        <Box px="md" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)', flexShrink: 0 }}>
          <Autocomplete
            ref={addUserInputRef}
            placeholder="Add user..."
            value={addUserQuery}
            onChange={setAddUserQuery}
            onOptionSubmit={handleAddUser}
            data={addUserOptions.map(o => o.value)}
            size="xs"
            comboboxProps={{ withinPortal: true, zIndex: 1400 }}
          />
        </Box>
      )}

      {/* Messages */}
      <Stack
        ref={messagesContainerRef}
        gap={4}
        px="md"
        pb="sm"
        onScroll={handleScroll}
        style={{
          overflowY: 'auto',
          flex: 1,
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        {isLoadingOlder && (
          <Group justify="center" pt="xs">
            <Loader size="xs" />
          </Group>
        )}
        <Box style={{ marginTop: 'auto' }} />
        {isLoading && (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        )}
        {messages.map(msg => {
          const isMe = msg.senderId === user?.id;
          const sender = senderNames.get(msg.senderId);

          return (
            <Box
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              <Group
                gap={6}
                align="flex-end"
                style={{ maxWidth: '85%', flexDirection: isMe ? 'row-reverse' : 'row' }}
              >
                {!isMe && (
                  <Avatar
                    size={28}
                    radius="xl"
                    color={sender?.color || 'gray'}
                    style={{ flexShrink: 0 }}
                  >
                    <Text size="xs">{sender?.initials || '?'}</Text>
                  </Avatar>
                )}
                <Box>
                  {!isMe && (
                    <Text size="xs" c="dimmed" mb={2}>
                      {sender?.name || msg.senderId}
                    </Text>
                  )}
                  <Paper
                    px="sm"
                    py={6}
                    radius="md"
                    bg={isMe ? `${accentColor}.0` : 'gray.0'}
                    style={{ wordBreak: 'break-word' }}
                  >
                    <Text size="sm">{msg.content}</Text>
                  </Paper>
                  <Text size="10px" c="dimmed" mt={2} ta={isMe ? 'right' : 'left'}>
                    {formatTime(msg.createdAt)}
                  </Text>
                </Box>
              </Group>
            </Box>
          );
        })}
      </Stack>

      {/* Input */}
      <Textarea
        value={draftMessage}
        onChange={handleDraftChange}
        onKeyDown={handleKeyDown}
        minRows={1}
        placeholder={t('chat.type_message', 'Escribe un mensaje...')}
        variant="unstyled"
        autosize
        px="md"
        py={4}
        disabled={isSending}
      />
    </Paper>
  );
}
