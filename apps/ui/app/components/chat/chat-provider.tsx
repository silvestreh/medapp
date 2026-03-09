import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Application } from '@feathersjs/feathers';

import { useTranslation } from 'react-i18next';

import { useFeathers, useAccount } from '~/components/provider';
import { createChatClient } from '~/chat-feathers';

type StatusValue = 'online' | 'offline' | 'away' | 'dnd';

export interface UserStatusEntry {
  id: string;
  userId: string;
  status: StatusValue;
  text: string | null;
  lastSeenAt: string;
}

export interface OrgUser {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  initials: string;
  fullName: string;
}

export interface ConversationEntry {
  id: string;
  participants: Array<{ id: string; userId: string; conversationId: string }>;
  updatedAt: string;
}

interface ChatContextType {
  chatClient: Application | null;
  isConnected: boolean;
  orgUsers: OrgUser[];
  conversations: ConversationEntry[];
  userStatuses: Map<string, UserStatusEntry>;
  getStatus: (userId: string) => StatusValue;
  getStatusText: (userId: string) => string | null;
  myStatus: StatusValue;
  setMyStatus: (status: StatusValue) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  refreshConversations: () => void;
  typingUsers: Map<string, Set<string>>;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: PropsWithChildren) {
  const mainClient = useFeathers();
  const { user } = useAccount();
  const { t } = useTranslation();
  const [chatClient, setChatClient] = useState<Application | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatusEntry>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const clientRef = useRef<Application | null>(null);
  const preferredStatusRef = useRef<StatusValue>('online');
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Create chat client when we have a token
  useEffect(() => {
    if (!mainClient || !user?.id) return;

    let cancelled = false;

    (async () => {
      try {
        // The main feathers client fires authenticate() without awaiting it,
        // so reAuthenticate() may fail if the JWT hasn't been stored yet.
        // Try first, and if it fails wait for the 'authenticated' event.
        let authResult: any;
        try {
          authResult = await (mainClient as any).reAuthenticate();
        } catch {
          if (cancelled) return;
          authResult = await new Promise<any>((resolve, reject) => {
            const onAuth = (result: any) => resolve(result);
            (mainClient as any).on('authenticated', onAuth);
            // Clean up if the effect is cancelled
            const check = setInterval(() => {
              if (cancelled) {
                clearInterval(check);
                (mainClient as any).removeListener('authenticated', onAuth);
                reject(new Error('cancelled'));
              }
            }, 200);
            // Also set a timeout to avoid hanging forever
            setTimeout(() => {
              clearInterval(check);
              (mainClient as any).removeListener('authenticated', onAuth);
              reject(new Error('Authentication timeout'));
            }, 10000);
          });
        }
        if (cancelled) return;
        const client = await createChatClient(authResult.accessToken);
        if (cancelled) return;

        clientRef.current = client;
        setChatClient(client);
        setIsConnected(true);

        // Listen for socket disconnect/reconnect to track connection state
        const socket = (client as any).io;
        if (socket) {
          socket.on('disconnect', () => {
            if (cancelled) return;
            setIsConnected(false);
          });
          socket.on('reconnect', () => {
            if (cancelled) return;
            setIsConnected(true);
            // Restore preferred status on reconnect
            const preferred = preferredStatusRef.current;
            if (preferred !== 'offline') {
              client
                .service('user-status')
                .find({ query: { userId: user!.id, $limit: 1 } })
                .then((res: any) => {
                  const items = Array.isArray(res) ? res : (res?.data ?? []);
                  if (items.length > 0) {
                    return client.service('user-status').patch(items[0].id, { status: preferred });
                  }
                })
                .catch(() => {
                  /* best-effort */
                });
            }
          });
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'cancelled') return;
        console.error('[Chat] Connection failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (clientRef.current) {
        try {
          (clientRef.current as any).io?.disconnect();
        } catch {
          /* ignore */
        }
        clientRef.current = null;
        setChatClient(null);
        setIsConnected(false);
      }
    };
  }, [mainClient, user?.id]);

  // Fetch org users from main API
  useEffect(() => {
    if (!mainClient || !user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await mainClient.service('organization-users').find({
          query: { $populate: true, $limit: 200 },
        });
        if (cancelled) return;

        const items = Array.isArray(response) ? response : ((response as any)?.data ?? []);
        const users: OrgUser[] = items
          .filter((m: any) => m.user && m.userId !== user!.id)
          .map((m: any) => {
            const pd = m.user.personalData;
            const firstName = pd?.firstName || '';
            const lastName = pd?.lastName || '';
            const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?';
            const fullName = `${firstName} ${lastName}`.trim() || m.user.username;
            return {
              userId: m.userId,
              username: m.user.username,
              firstName,
              lastName,
              initials,
              fullName,
            };
          });

        setOrgUsers(users);
      } catch {
        // Non-fatal
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mainClient, user?.id]);

  // Fetch conversations from chat API
  const fetchConversations = useCallback(async () => {
    if (!chatClient || !isConnected) return;
    try {
      const response = await chatClient.service('conversations').find({
        query: { $limit: 200, $sort: { updatedAt: -1 } },
      });
      const items = Array.isArray(response) ? response : ((response as any)?.data ?? []);
      setConversations(items);
    } catch {
      // Non-fatal
    }
  }, [chatClient, isConnected]);

  useEffect(() => {
    if (!chatClient || !isConnected) return;
    fetchConversations();

    const participantsService = chatClient.service('conversation-participants');
    participantsService.on('created', fetchConversations);
    participantsService.on('removed', fetchConversations);

    return () => {
      participantsService.removeListener('created', fetchConversations);
      participantsService.removeListener('removed', fetchConversations);
    };
  }, [chatClient, isConnected, fetchConversations]);

  const leaveConversation = useCallback(
    async (conversationId: string) => {
      if (!chatClient || !user?.id) return;
      try {
        // Send system message before leaving
        const pd = user.personalData as Record<string, string> | undefined;
        const firstName = pd?.firstName ?? '';
        const lastName = pd?.lastName ?? '';
        const shortName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName || '?';
        await chatClient.service('messages').create({
          conversationId,
          content: t('chat.left_conversation', { name: shortName }),
          type: 'system',
        });

        // Find our participation record
        const response = await chatClient.service('conversation-participants').find({
          query: { conversationId, userId: user.id, $limit: 1 },
        });
        const items = Array.isArray(response) ? response : ((response as any)?.data ?? []);
        if (items.length > 0) {
          await chatClient.service('conversation-participants').remove(items[0].id);
        }
        // Refresh conversations list
        setConversations(prev => prev.filter(c => c.id !== conversationId));
      } catch {
        // best-effort
      }
    },
    [chatClient, user?.id, t]
  );

  // Fetch user statuses from chat API + listen to real-time updates
  useEffect(() => {
    if (!chatClient || !isConnected || orgUsers.length === 0) return;
    let cancelled = false;

    const userIds = orgUsers.map(u => u.userId);
    // Also include self so we can display our own status
    if (user?.id) userIds.push(user.id);

    (async () => {
      try {
        const response = await chatClient.service('user-status').find({
          query: { userId: { $in: userIds }, $limit: 200 },
        });
        if (cancelled) return;

        const items: UserStatusEntry[] = Array.isArray(response) ? response : ((response as any)?.data ?? []);
        const map = new Map<string, UserStatusEntry>();
        items.forEach(s => map.set(s.userId, s));
        setUserStatuses(map);
      } catch {
        // Non-fatal
      }
    })();

    const handleStatusChange = (entry: UserStatusEntry) => {
      setUserStatuses(prev => {
        const next = new Map(prev);
        next.set(entry.userId, entry);
        return next;
      });
    };

    const service = chatClient.service('user-status');
    service.on('created', handleStatusChange);
    service.on('patched', handleStatusChange);

    return () => {
      cancelled = true;
      service.removeListener('created', handleStatusChange);
      service.removeListener('patched', handleStatusChange);
    };
  }, [chatClient, isConnected, orgUsers, user?.id]);

  const getStatus = useCallback(
    (userId: string): StatusValue => userStatuses.get(userId)?.status ?? 'offline',
    [userStatuses]
  );

  const getStatusText = useCallback(
    (userId: string): string | null => userStatuses.get(userId)?.text ?? null,
    [userStatuses]
  );

  const myStatus = useMemo<StatusValue>(
    () => (user?.id ? (userStatuses.get(user.id)?.status ?? 'online') : 'offline'),
    [user?.id, userStatuses]
  );

  const setMyStatus = useCallback(
    async (status: StatusValue) => {
      if (!chatClient || !user?.id) return;
      // Remember the user's chosen status so we can restore it on reconnect
      preferredStatusRef.current = status;
      try {
        const existing = userStatuses.get(user.id);
        if (existing) {
          await chatClient.service('user-status').patch(existing.id, { status });
        } else {
          await chatClient.service('user-status').create({ userId: user.id, status });
        }
      } catch {
        // best-effort
      }
    },
    [chatClient, user?.id, userStatuses]
  );

  // Typing indicators via raw socket events
  useEffect(() => {
    if (!chatClient || !user?.id) return;
    const socket = (chatClient as any).io;
    if (!socket) return;

    const handleTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (data.userId === user!.id) return;

      setTypingUsers(prev => {
        const next = new Map(prev);
        const current = new Set(next.get(data.conversationId) ?? []);
        if (data.isTyping) {
          current.add(data.userId);
        } else {
          current.delete(data.userId);
        }
        if (current.size === 0) {
          next.delete(data.conversationId);
        } else {
          next.set(data.conversationId, current);
        }
        return next;
      });

      // Auto-clear after 3s in case stop event is missed
      const timerKey = `${data.conversationId}:${data.userId}`;
      const existing = typingTimersRef.current.get(timerKey);
      if (existing) clearTimeout(existing);
      if (data.isTyping) {
        typingTimersRef.current.set(
          timerKey,
          setTimeout(() => {
            setTypingUsers(prev => {
              const next = new Map(prev);
              const current = new Set(next.get(data.conversationId) ?? []);
              current.delete(data.userId);
              if (current.size === 0) {
                next.delete(data.conversationId);
              } else {
                next.set(data.conversationId, current);
              }
              return next;
            });
            typingTimersRef.current.delete(timerKey);
          }, 3000)
        );
      } else {
        typingTimersRef.current.delete(timerKey);
      }
    };

    socket.on('typing', handleTyping);
    return () => {
      socket.removeListener('typing', handleTyping);
    };
  }, [chatClient, user?.id]);

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      if (!chatClient || !user?.id) return;
      const socket = (chatClient as any).io;
      if (!socket) return;
      socket.emit('typing', { conversationId, userId: user.id, isTyping });
    },
    [chatClient, user?.id]
  );

  const value = useMemo<ChatContextType>(
    () => ({
      chatClient,
      isConnected,
      orgUsers,
      conversations,
      userStatuses,
      getStatus,
      getStatusText,
      myStatus,
      setMyStatus,
      leaveConversation,
      refreshConversations: fetchConversations,
      typingUsers,
      sendTyping,
    }),
    [
      chatClient,
      isConnected,
      orgUsers,
      conversations,
      userStatuses,
      getStatus,
      getStatusText,
      myStatus,
      setMyStatus,
      leaveConversation,
      fetchConversations,
      typingUsers,
      sendTyping,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
