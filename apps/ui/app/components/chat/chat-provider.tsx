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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: PropsWithChildren) {
  const mainClient = useFeathers();
  const { user } = useAccount();
  const [chatClient, setChatClient] = useState<Application | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatusEntry>>(new Map());
  const clientRef = useRef<Application | null>(null);
  const preferredStatusRef = useRef<StatusValue>('online');

  // Create chat client when we have a token
  useEffect(() => {
    console.log('[ChatProvider] effect fired — mainClient:', !!mainClient, 'user:', user?.id ?? 'null');
    if (!mainClient || !user?.id) return;

    let cancelled = false;

    (async () => {
      try {
        console.log('[ChatProvider] calling mainClient.reAuthenticate()...');
        const authResult = await (mainClient as any).reAuthenticate();
        if (cancelled) return;
        console.log('[ChatProvider] got token, length:', authResult.accessToken?.length);

        console.log('[ChatProvider] creating chat client...');
        const client = await createChatClient(authResult.accessToken);
        if (cancelled) return;
        console.log('[ChatProvider] chat client created and authenticated!');

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
        console.error('[ChatProvider] Connection failed:', err);
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
        query: { $limit: 200 },
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
  }, [chatClient, isConnected, fetchConversations]);

  const leaveConversation = useCallback(
    async (conversationId: string) => {
      if (!chatClient || !user?.id) return;
      try {
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
    [chatClient, user?.id]
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
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
