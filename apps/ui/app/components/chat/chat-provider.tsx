import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
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

interface ChatContextType {
  chatClient: Application | null;
  isConnected: boolean;
  orgUsers: OrgUser[];
  userStatuses: Map<string, UserStatusEntry>;
  getStatus: (userId: string) => StatusValue;
  getStatusText: (userId: string) => string | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: PropsWithChildren) {
  const mainClient = useFeathers();
  const { user } = useAccount();
  const [chatClient, setChatClient] = useState<Application | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatusEntry>>(new Map());
  const clientRef = useRef<Application | null>(null);

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
      } catch (err) {
        console.error('[ChatProvider] Connection failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (clientRef.current) {
        try {
          (clientRef.current as any).io?.disconnect();
        } catch { /* ignore */ }
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

        const items = Array.isArray(response) ? response : (response as any)?.data ?? [];
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

    return () => { cancelled = true; };
  }, [mainClient, user?.id]);

  // Fetch user statuses from chat API + listen to real-time updates
  useEffect(() => {
    if (!chatClient || !isConnected) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await chatClient.service('user-status').find({
          query: { $limit: 200 },
        });
        if (cancelled) return;

        const items: UserStatusEntry[] = Array.isArray(response)
          ? response
          : (response as any)?.data ?? [];
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
  }, [chatClient, isConnected]);

  const getStatus = useCallback(
    (userId: string): StatusValue => userStatuses.get(userId)?.status ?? 'offline',
    [userStatuses]
  );

  const getStatusText = useCallback(
    (userId: string): string | null => userStatuses.get(userId)?.text ?? null,
    [userStatuses]
  );

  const value = useMemo<ChatContextType>(
    () => ({ chatClient, isConnected, orgUsers, userStatuses, getStatus, getStatusText }),
    [chatClient, isConnected, orgUsers, userStatuses, getStatus, getStatusText]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
