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
import { ArrowDownRight, Reply, UserPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useChat } from '~/components/chat/chat-provider';
import { useAccount } from '~/components/provider';
import { media } from '~/media';
import { deterministicColor, type ChatParticipant } from '~/components/chat-manager';
import { useChatManager } from '~/components/chat-manager';

interface ReplySnippet {
  id: string;
  senderId: string;
  content: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system';
  createdAt: string;
  updatedAt: string;
  replyToId?: string | null;
  replyTo?: ReplySnippet | null;
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
  accentColor,
}: {
  participants: ChatParticipant[];
  currentUserId: string;
  accentColor: string;
  groupLabel: string;
}) {
  const others = participants.filter(p => p.userId !== currentUserId);
  const size = 24;
  const overlap = 8;

  return (
    <ScrollArea scrollbarSize={0} style={{ flexShrink: 1, minWidth: 0 }} type="scroll">
      <Group gap={0} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Box
          style={{
            display: 'flex',
            position: 'relative',
            height: size,
            width: size + (others.length - 1) * (size - overlap),
            flexShrink: 0,
          }}
        >
          {others.map((p, idx) => {
            const pColor = deterministicColor(p.userId);
            return (
              <Avatar
                key={p.userId}
                size={size}
                radius="xl"
                color={pColor}
                variant="filled"
                style={{
                  position: 'absolute',
                  left: idx * (size - overlap),
                  zIndex: others.length - idx,
                  border: `2px solid var(--mantine-color-${accentColor}-5)`,
                  fontSize: 10,
                }}
              >
                {p.initials}
              </Avatar>
            );
          })}
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
  const { chatClient, orgUsers, typingUsers, sendTyping } = useChat();
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
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const addUserInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

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

        const items: Message[] = Array.isArray(response) ? response : ((response as any)?.data ?? []);
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
      loadedRef.current = false;
      setIsLoading(false);
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

    const handlePatched = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      setMessages(prev => prev.map(m => (m.id === message.id ? { ...m, ...message } : m)));
    };

    const service = chatClient.service('messages');
    service.on('created', handleCreated);
    service.on('patched', handlePatched);
    return () => {
      service.removeListener('created', handleCreated);
      service.removeListener('patched', handlePatched);
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

      const items: Message[] = Array.isArray(response) ? response : ((response as any)?.data ?? []);

      if (items.length === 0) {
        setHasMore(false);
        return;
      }

      isPrependingRef.current = true;
      setMessages(prev => [...items.slice().reverse(), ...prev]);
      setHasMore(items.length === PAGE_SIZE);

      window.requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - prevHeight + prevTop;
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
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(conversationId, false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
    const currentEditId = editingMessageId;
    setEditingMessageId(null);
    const replyToId = replyTo?.id ?? undefined;
    setReplyTo(null);
    try {
      if (currentEditId) {
        await chatClient.service('messages').patch(currentEditId, { content });
        setMessages(prev => prev.map(m => (m.id === currentEditId ? { ...m, content } : m)));
      } else {
        await chatClient.service('messages').create({
          conversationId,
          content,
          ...(replyToId ? { replyToId } : {}),
        });
      }
    } catch (err) {
      console.warn('[Chat] Failed to send message:', err);
      setDraftMessage(content);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatClient, conversationId, draftMessage, isSending, replyTo, editingMessageId]);

  const handleDraftChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.currentTarget.value;
      setDraftMessage(value);

      if (value.length > 0 && !isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(conversationId, true);
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          sendTyping(conversationId, false);
        }
      }, 2000);

      if (value.length === 0 && isTypingRef.current) {
        isTypingRef.current = false;
        sendTyping(conversationId, false);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      }
    },
    [conversationId, sendTyping]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;

      // Escape cancels editing
      if (e.key === 'Escape' && editingMessageId) {
        e.preventDefault();
        setEditingMessageId(null);
        setDraftMessage('');
        return;
      }

      // ArrowUp on empty input → edit last own message
      if (e.key === 'ArrowUp' && !draftMessage && !editingMessageId) {
        const lastOwn = [...messages].reverse().find(m => m.senderId === user?.id && m.type !== 'system');
        if (lastOwn) {
          e.preventDefault();
          setEditingMessageId(lastOwn.id);
          setDraftMessage(lastOwn.content);
        }
        return;
      }

      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      handleSend();
    },
    [handleSend, editingMessageId, draftMessage, messages, user?.id]
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

  const handleReply = useCallback((msg: Message) => {
    setReplyTo(msg);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

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

        // Send system message
        const shortName = `${match.firstName} ${match.lastName.charAt(0)}.`;
        await chatClient.service('messages').create({
          conversationId,
          content: t('chat.entered_conversation', { name: shortName }),
          type: 'system',
        });

        const newParticipant: ChatParticipant = {
          userId: match.userId,
          name: match.fullName,
          initials: match.initials,
        };
        const updated = [...(participants ?? []), newParticipant];
        const groupName =
          `${t('chat.group_label')} ` +
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
    [chatClient, conversationId, orgUsers, participants, user?.id, chatKey, updateChatParticipants, t]
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
        name: t('chat.you'),
        initials:
          `${(user.personalData as Record<string, string>)?.firstName?.[0] ?? ''}${(user.personalData as Record<string, string>)?.lastName?.[0] ?? ''}`.toUpperCase() ||
          '?',
        color: 'blue',
      });
    }
    return map;
  }, [orgUsers, user, t]);

  const typingLabel = useMemo(() => {
    const typers = typingUsers.get(conversationId);
    if (!typers || typers.size === 0) return null;

    const names = [...typers].map(uid => senderNames.get(uid)?.name ?? '').filter(Boolean);

    if (names.length === 0) return null;
    if (names.length === 1) return t('chat.typing_one', { name: names[0] });
    if (names.length === 2) return t('chat.typing_two', { name1: names[0], name2: names[1] });
    return t('chat.typing_many', { names: `${names.slice(0, -1).join(', ')}, ${names[names.length - 1]}` });
  }, [typingUsers, conversationId, senderNames, t]);

  if (!isDesktop) return null;

  return (
    <Paper
      withBorder
      radius="md"
      style={{
        width: 'min(380px, calc(100vw - 6rem))',
        height: 'min(60vh, 560px)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.075), 0 8px 32px rgba(0,0,0,0.075), 0 24px 48px rgba(0,0,0,0.075)',
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
          <ParticipantAvatars
            participants={participants}
            currentUserId={user?.id ?? ''}
            accentColor={accentColor}
            groupLabel={t('chat.group_label')}
          />
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
            placeholder={t('chat.add_user_placeholder')}
            value={addUserQuery}
            onChange={setAddUserQuery}
            onOptionSubmit={handleAddUser}
            data={addUserOptions.map(o => o.value)}
            size="xs"
            comboboxProps={{ withinPortal: true, zIndex: 1400 }}
          />
        </Box>
      )}

      {/* Hover-to-reveal reply button + highlight flash */}
      <style>{`
        .chat-msg-row:hover .chat-msg-reply-btn { opacity: 1 !important; }
        .chat-msg-row p { margin: 0; }
        .chat-msg-row pre { margin: 4px 0; padding: 6px 8px; border-radius: 4px; background: rgba(0,0,0,0.05); overflow-x: auto; }
        .chat-msg-row code { font-size: 0.8em; padding: 1px 4px; border-radius: 3px; background: rgba(0,0,0,0.06); }
        .chat-msg-row pre code { padding: 0; background: none; }
        .chat-msg-row ul, .chat-msg-row ol { margin: 2px 0; padding-left: 1.2em; }
        .chat-msg-row blockquote { margin: 4px 0; padding-left: 8px; border-left: 3px solid var(--mantine-color-gray-4); color: var(--mantine-color-gray-6); }
        .chat-msg-highlight { box-shadow: inset 0 0 0 40rem var(--mantine-primary-color-2); transition: box-shadow 300ms; }
        .chat-msg-highlight-fade { box-shadow: inset 0 0 0 40rem transparent; }
      `}</style>

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
          if (msg.type === 'system') {
            return (
              <Text key={msg.id} size="xs" c="dimmed" ta="center" py={4} fs="italic">
                {msg.content}
              </Text>
            );
          }

          const isMe = msg.senderId === user?.id;
          const sender = senderNames.get(msg.senderId);
          const quotedSender = msg.replyTo ? senderNames.get(msg.replyTo.senderId) : null;

          return (
            <Box
              key={msg.id}
              className="chat-msg-row"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                position: 'relative',
              }}
            >
              <Group gap={6} align="flex-end" style={{ maxWidth: '85%', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                {!isMe && (
                  <Avatar size={28} radius="xl" color={sender?.color || 'gray'} style={{ flexShrink: 0 }}>
                    <Text size="xs">{sender?.initials || '?'}</Text>
                  </Avatar>
                )}
                <Box style={{ position: 'relative' }}>
                  {!isMe && (
                    <Text size="xs" c="dimmed" mb={2}>
                      {sender?.name || msg.senderId}
                    </Text>
                  )}
                  {/* Quoted message */}
                  {msg.replyTo && (
                    <Box
                      px="sm"
                      py={4}
                      mb={2}
                      style={{
                        borderLeft: `3px solid var(--mantine-color-${quotedSender?.color || 'gray'}-4)`,
                        borderRadius: '0 8px 8px 0',
                        backgroundColor: 'var(--mantine-color-gray-1)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const el = messagesContainerRef.current?.querySelector(`[data-msg-id="${msg.replyTo!.id}"]`);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('chat-msg-highlight');
                          el.classList.remove('chat-msg-highlight-fade');
                          setTimeout(() => {
                            el.classList.add('chat-msg-highlight-fade');
                            setTimeout(() => {
                              el.classList.remove('chat-msg-highlight', 'chat-msg-highlight-fade');
                            }, 300);
                          }, 1200);
                        }
                      }}
                    >
                      <Text size="xs" fw={600} c={`${quotedSender?.color || 'gray'}.6`}>
                        {quotedSender?.name || msg.replyTo.senderId}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {msg.replyTo.content}
                      </Text>
                    </Box>
                  )}
                  <Paper
                    px="sm"
                    py={6}
                    radius="md"
                    bg={isMe ? `${accentColor}.0` : 'gray.0'}
                    style={{ wordBreak: 'break-word', fontSize: '0.875rem', lineHeight: 1.5 }}
                    data-msg-id={msg.id}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </Paper>
                  <Text size="10px" c="dimmed" mt={2} ta={isMe ? 'right' : 'left'}>
                    {msg.updatedAt !== msg.createdAt && `${t('chat.edited')} `}
                    {formatTime(msg.createdAt)}
                  </Text>
                  {/* Reply button — visible on row hover */}
                  <ActionIcon
                    className="chat-msg-reply-btn"
                    variant="subtle"
                    color="dark"
                    size="sm"
                    onClick={() => handleReply(msg)}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      [isMe ? 'left' : 'right']: -30,
                      opacity: 0,
                      transition: 'opacity 120ms',
                    }}
                  >
                    <Reply size={18} />
                  </ActionIcon>
                </Box>
              </Group>
            </Box>
          );
        })}
        {typingLabel && (
          <Text size="xs" c="dimmed" fs="italic" px="md" py={2} style={{ flexShrink: 0 }}>
            {typingLabel}
          </Text>
        )}
      </Stack>

      {/* Reply preview */}
      {replyTo && (
        <Group
          gap="xs"
          px="md"
          py={6}
          align="center"
          style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--mantine-color-gray-2)',
            backgroundColor: 'var(--mantine-color-gray-0)',
          }}
        >
          <Box
            style={{
              flex: 1,
              minWidth: 0,
              borderLeft: `3px solid var(--mantine-color-${senderNames.get(replyTo.senderId)?.color || 'gray'}-4)`,
              paddingLeft: 8,
            }}
          >
            <Text size="xs" fw={600} c={`${senderNames.get(replyTo.senderId)?.color || 'gray'}.6`} lineClamp={1}>
              {senderNames.get(replyTo.senderId)?.name || replyTo.senderId}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {replyTo.content}
            </Text>
          </Box>
          <ActionIcon variant="subtle" color="gray" size="xs" onClick={handleCancelReply}>
            <X size={14} />
          </ActionIcon>
        </Group>
      )}

      {/* Editing indicator */}
      {editingMessageId && (
        <Group
          gap="xs"
          px="md"
          py={4}
          align="center"
          style={{
            flexShrink: 0,
            backgroundColor: 'var(--mantine-color-yellow-0)',
            borderBottom: '1px solid var(--mantine-color-yellow-3)',
          }}
        >
          <Text size="xs" c="dimmed" style={{ flex: 1 }}>
            {t('chat.editing_message')}
          </Text>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            onClick={() => {
              setEditingMessageId(null);
              setDraftMessage('');
            }}
          >
            <X size={14} />
          </ActionIcon>
        </Group>
      )}

      {/* Input */}
      <Textarea
        ref={textareaRef}
        value={draftMessage}
        onChange={handleDraftChange}
        onKeyDown={handleKeyDown}
        minRows={1}
        placeholder={t('chat.type_message')}
        variant="unstyled"
        autosize
        px="md"
        py={4}
        disabled={isSending}
      />
    </Paper>
  );
}
