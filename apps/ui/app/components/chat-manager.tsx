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

import { useFeathers, useAccount } from '~/components/provider';
import { useChat } from '~/components/chat/chat-provider';

export type ChatType = 'encounter' | 'messaging';

export interface ChatParticipant {
  userId: string;
  name: string;
  initials: string;
}

export interface ChatInstance {
  patientId: string;
  patientName: string;
  patientInitials: string;
  color: string;
  encounterDraft: Record<string, any>;
  isActive: boolean;
  type: ChatType;
  conversationId?: string;
  participants?: ChatParticipant[];
}

interface ChatManagerContextType {
  chats: ChatInstance[];
  activeChatPatientId: string | null;
  unreadCounts: Map<string, number>;
  openChat(patient: { id: string; firstName: string; lastName: string }): void;
  openMessagingChat(opts: {
    conversationId: string;
    userId: string;
    name: string;
    initials: string;
    participants?: ChatParticipant[];
  }): void;
  updateChatParticipants(patientId: string, participants: ChatParticipant[], name: string): void;
  closeChat(patientId: string): void;
  activateChat(patientId: string): void;
  minimizeActiveChat(): void;
  updateEncounterDraft(patientId: string, draft: Record<string, any>): void;
  reorderChat(patientId: string, toIndex: number): void;
}

const COLORS = ['blue', 'teal', 'violet', 'pink', 'orange', 'cyan', 'green', 'grape', 'indigo'];
const PERSIST_DEBOUNCE_MS = 1000;

export function deterministicColor(id: string, usedColors: string[] = []): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const preferred = COLORS[Math.abs(hash) % COLORS.length];
  if (!usedColors.includes(preferred)) return preferred;

  // Find the first unused color
  const available = COLORS.find(c => !usedColors.includes(c));
  if (available) return available;

  // All colors taken, fall back to hash
  return preferred;
}

interface PersistedHead {
  patientId: string;
  patientName: string;
  patientInitials: string;
  color: string;
  type?: ChatType;
  conversationId?: string;
  participants?: ChatParticipant[];
}

function toPersistedHeads(chats: ChatInstance[]): PersistedHead[] {
  return chats.map(c => ({
    patientId: c.patientId,
    patientName: c.patientName,
    patientInitials: c.patientInitials,
    color: c.color,
    ...(c.type === 'messaging' && {
      type: c.type,
      conversationId: c.conversationId,
      participants: c.participants,
    }),
  }));
}

function fromPersistedHeads(heads: PersistedHead[]): ChatInstance[] {
  const usedColors: string[] = [];
  return heads.map(h => {
    const color = h.color || deterministicColor(h.patientId, usedColors);
    usedColors.push(color);
    return {
      ...h,
      color,
      encounterDraft: {},
      isActive: false,
      type: h.type || 'encounter',
      conversationId: h.conversationId,
      participants: h.participants,
    };
  });
}

const ChatManagerContext = createContext<ChatManagerContextType | undefined>(undefined);

export function ChatManagerProvider({ children }: PropsWithChildren) {
  const client = useFeathers();
  const { user } = useAccount();
  const { chatClient, orgUsers } = useChat();
  const [chats, setChats] = useState<ChatInstance[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>('');

  // Load chat heads from server on mount
  useEffect(() => {
    if (!client || !user?.id || loaded) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await client.service('users').get(user.id);
        if (cancelled) return;
        const heads: PersistedHead[] = (result as any)?.preferences?.chatHeads || [];
        if (heads.length > 0) {
          const instances = fromPersistedHeads(heads);
          setChats(instances);
          lastPersistedRef.current = JSON.stringify(toPersistedHeads(instances));
        }
      } catch {
        // fall through — start with empty chats
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, user?.id, loaded]);

  // Debounced persist to server
  useEffect(() => {
    if (!loaded || !client || !user?.id) return;

    const heads = toPersistedHeads(chats);
    const serialized = JSON.stringify(heads);

    // Skip if nothing changed
    if (serialized === lastPersistedRef.current) return;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    persistTimerRef.current = setTimeout(async () => {
      try {
        const currentUser = await client.service('users').get(user!.id);
        const currentPrefs = (currentUser as any)?.preferences ?? {};
        await client.service('users').patch(user!.id, {
          preferences: { ...currentPrefs, chatHeads: heads },
        });
        lastPersistedRef.current = serialized;
      } catch {
        // best-effort persistence
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, loaded, client, user?.id]);

  // Listen for incoming messages globally — create minimized heads for new conversations, track unread
  const chatsRef = useRef(chats);
  chatsRef.current = chats;

  useEffect(() => {
    if (!chatClient || !user?.id) return;

    const handleMessage = (message: { conversationId: string; senderId: string }) => {
      if (message.senderId === user!.id) return;

      const key = `msg-${message.conversationId}`;
      const current = chatsRef.current;
      const existing = current.find(c => c.patientId === key);

      if (existing) {
        // Chat head exists — increment unread if not active
        if (!existing.isActive) {
          setUnreadCounts(prev => {
            const next = new Map(prev);
            next.set(key, (prev.get(key) ?? 0) + 1);
            return next;
          });
        }
      } else {
        // No chat head — fetch conversation details and create a minimized head
        chatClient
          .service('conversations')
          .get(message.conversationId)
          .then((conversation: any) => {
            const participants: ChatParticipant[] = (conversation.participants || []).map((p: any) => {
              const orgUser = orgUsers.find(u => u.userId === p.userId);
              if (orgUser) {
                return { userId: p.userId, name: orgUser.fullName, initials: orgUser.initials };
              }
              if (p.userId === user!.id) {
                const pd = user!.personalData as Record<string, string>;
                const initials = `${pd?.firstName?.[0] ?? ''}${pd?.lastName?.[0] ?? ''}`.toUpperCase() || '?';
                return { userId: p.userId, name: 'You', initials };
              }
              return { userId: p.userId, name: p.userId, initials: '?' };
            });

            const others = participants.filter(p => p.userId !== user!.id);
            const isGroup = participants.length > 2;
            const name = isGroup ? `Group: ${others.map(p => p.initials).join(', ')}` : (others[0]?.name ?? '');
            const initials = isGroup ? 'G' : (others[0]?.initials ?? '?');

            const usedColors = chatsRef.current.map(c => c.color);
            const color = deterministicColor(message.conversationId, usedColors);

            setChats(prev => {
              // Double-check it hasn't been added in the meantime
              if (prev.some(c => c.patientId === key)) return prev;
              return [
                ...prev,
                {
                  patientId: key,
                  patientName: name,
                  patientInitials: initials,
                  color,
                  encounterDraft: {},
                  isActive: false,
                  type: 'messaging' as ChatType,
                  conversationId: message.conversationId,
                  participants,
                },
              ];
            });

            setUnreadCounts(prev => {
              const next = new Map(prev);
              next.set(key, 1);
              return next;
            });
          })
          .catch(() => {
            /* best-effort */
          });
      }
    };

    const service = chatClient.service('messages');
    service.on('created', handleMessage);
    return () => {
      service.removeListener('created', handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatClient, user?.id, orgUsers]);

  const activeChatPatientId = useMemo(() => chats.find(c => c.isActive)?.patientId ?? null, [chats]);

  const openChat = useCallback((patient: { id: string; firstName: string; lastName: string }) => {
    setChats(prev => {
      const existing = prev.find(c => c.patientId === patient.id);
      if (existing) {
        return prev.map(c => ({ ...c, isActive: c.patientId === patient.id }));
      }
      const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() || '?';
      const name = `${patient.firstName} ${patient.lastName}`.trim();
      const usedColors = prev.map(c => c.color);
      const color = deterministicColor(patient.id, usedColors);
      return [
        ...prev.map(c => ({ ...c, isActive: false })),
        {
          patientId: patient.id,
          patientName: name,
          patientInitials: initials,
          color,
          encounterDraft: {},
          isActive: true,
          type: 'encounter' as ChatType,
        },
      ];
    });
  }, []);

  const openMessagingChat = useCallback(
    (opts: {
      conversationId: string;
      userId: string;
      name: string;
      initials: string;
      participants?: ChatParticipant[];
    }) => {
      const key = `msg-${opts.conversationId}`;
      setChats(prev => {
        const existing = prev.find(c => c.patientId === key);
        if (existing) {
          return prev.map(c => ({ ...c, isActive: c.patientId === key }));
        }
        const usedColors = prev.map(c => c.color);
        const color = deterministicColor(opts.conversationId, usedColors);
        return [
          ...prev.map(c => ({ ...c, isActive: false })),
          {
            patientId: key,
            patientName: opts.name,
            patientInitials: opts.initials,
            color,
            encounterDraft: {},
            isActive: true,
            type: 'messaging' as ChatType,
            conversationId: opts.conversationId,
            participants: opts.participants,
          },
        ];
      });
      setUnreadCounts(prev => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    []
  );

  const closeChat = useCallback((patientId: string) => {
    setChats(prev => prev.filter(c => c.patientId !== patientId));
  }, []);

  const activateChat = useCallback((patientId: string) => {
    setChats(prev => prev.map(c => ({ ...c, isActive: c.patientId === patientId })));
    setUnreadCounts(prev => {
      if (!prev.has(patientId)) return prev;
      const next = new Map(prev);
      next.delete(patientId);
      return next;
    });
  }, []);

  const minimizeActiveChat = useCallback(() => {
    setChats(prev => prev.map(c => (c.isActive ? { ...c, isActive: false } : c)));
  }, []);

  const updateEncounterDraft = useCallback((patientId: string, draft: Record<string, any>) => {
    setChats(prev => prev.map(c => (c.patientId === patientId ? { ...c, encounterDraft: draft } : c)));
  }, []);

  const updateChatParticipants = useCallback((patientId: string, participants: ChatParticipant[], name: string) => {
    setChats(prev => prev.map(c => (c.patientId === patientId ? { ...c, participants, patientName: name } : c)));
  }, []);

  const reorderChat = useCallback((patientId: string, toIndex: number) => {
    setChats(prev => {
      const fromIndex = prev.findIndex(c => c.patientId === patientId);
      if (fromIndex === -1 || fromIndex === toIndex || toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const value = useMemo<ChatManagerContextType>(
    () => ({
      chats,
      activeChatPatientId,
      unreadCounts,
      openChat,
      openMessagingChat,
      updateChatParticipants,
      closeChat,
      activateChat,
      minimizeActiveChat,
      updateEncounterDraft,
      reorderChat,
    }),
    [
      chats,
      activeChatPatientId,
      unreadCounts,
      openChat,
      openMessagingChat,
      updateChatParticipants,
      closeChat,
      activateChat,
      minimizeActiveChat,
      updateEncounterDraft,
      reorderChat,
    ]
  );

  return <ChatManagerContext.Provider value={value}>{children}</ChatManagerContext.Provider>;
}

export function useChatManager() {
  const ctx = useContext(ChatManagerContext);
  if (!ctx) throw new Error('useChatManager must be used within ChatManagerProvider');
  return ctx;
}
