import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useFeathers, useAccount } from '~/components/provider';

export interface ChatInstance {
  patientId: string;
  patientName: string;
  patientInitials: string;
  encounterDraft: Record<string, any>;
  isActive: boolean;
}

interface ChatManagerContextType {
  chats: ChatInstance[];
  activeChatPatientId: string | null;
  openChat(patient: { id: string; firstName: string; lastName: string }): void;
  closeChat(patientId: string): void;
  activateChat(patientId: string): void;
  minimizeActiveChat(): void;
  updateEncounterDraft(patientId: string, draft: Record<string, any>): void;
  reorderChat(patientId: string, toIndex: number): void;
}

const COLORS = ['blue', 'teal', 'violet', 'pink', 'orange', 'cyan', 'green', 'grape', 'indigo'];
const PERSIST_DEBOUNCE_MS = 1000;

export function deterministicColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface PersistedHead {
  patientId: string;
  patientName: string;
  patientInitials: string;
}

function toPersistedHeads(chats: ChatInstance[]): PersistedHead[] {
  return chats.map(c => ({
    patientId: c.patientId,
    patientName: c.patientName,
    patientInitials: c.patientInitials,
  }));
}

function fromPersistedHeads(heads: PersistedHead[]): ChatInstance[] {
  return heads.map(h => ({ ...h, encounterDraft: {}, isActive: false }));
}

const ChatManagerContext = createContext<ChatManagerContextType | undefined>(undefined);

export function ChatManagerProvider({ children }: PropsWithChildren) {
  const client = useFeathers();
  const { user } = useAccount();
  const [chats, setChats] = useState<ChatInstance[]>([]);
  const [loaded, setLoaded] = useState(false);
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

    return () => { cancelled = true; };
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
        await client.service('users').patch(user!.id, {
          preferences: { chatHeads: heads },
        });
        lastPersistedRef.current = serialized;
      } catch {
        // best-effort persistence
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [chats, loaded, client, user?.id]);

  const activeChatPatientId = useMemo(
    () => chats.find(c => c.isActive)?.patientId ?? null,
    [chats],
  );

  const openChat = useCallback((patient: { id: string; firstName: string; lastName: string }) => {
    setChats(prev => {
      const existing = prev.find(c => c.patientId === patient.id);
      if (existing) {
        return prev.map(c => ({ ...c, isActive: c.patientId === patient.id }));
      }
      const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() || '?';
      const name = `${patient.firstName} ${patient.lastName}`.trim();
      return [
        ...prev.map(c => ({ ...c, isActive: false })),
        { patientId: patient.id, patientName: name, patientInitials: initials, encounterDraft: {}, isActive: true },
      ];
    });
  }, []);

  const closeChat = useCallback((patientId: string) => {
    setChats(prev => prev.filter(c => c.patientId !== patientId));
  }, []);

  const activateChat = useCallback((patientId: string) => {
    setChats(prev => prev.map(c => ({ ...c, isActive: c.patientId === patientId })));
  }, []);

  const minimizeActiveChat = useCallback(() => {
    setChats(prev => prev.map(c => (c.isActive ? { ...c, isActive: false } : c)));
  }, []);

  const updateEncounterDraft = useCallback((patientId: string, draft: Record<string, any>) => {
    setChats(prev => prev.map(c => (c.patientId === patientId ? { ...c, encounterDraft: draft } : c)));
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
    () => ({ chats, activeChatPatientId, openChat, closeChat, activateChat, minimizeActiveChat, updateEncounterDraft, reorderChat }),
    [chats, activeChatPatientId, openChat, closeChat, activateChat, minimizeActiveChat, updateEncounterDraft, reorderChat],
  );

  return <ChatManagerContext.Provider value={value}>{children}</ChatManagerContext.Provider>;
}

export function useChatManager() {
  const ctx = useContext(ChatManagerContext);
  if (!ctx) throw new Error('useChatManager must be used within ChatManagerProvider');
  return ctx;
}
