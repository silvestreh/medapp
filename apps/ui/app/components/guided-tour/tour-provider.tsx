import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useFeathers, useAccount } from '~/components/provider';

const PERSIST_DEBOUNCE_MS = 500;

interface TourContextValue {
  completedTours: Record<string, boolean>;
  activeTourId: string | null;
  startTour: (tourId: string) => void;
  completeTour: (tourId: string) => void;
  resetTour: (tourId: string) => void;
  resetAllTours: () => void;
  isTourCompleted: (tourId: string) => boolean;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export const TourProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const client = useFeathers();
  const { user } = useAccount();

  const [completedTours, setCompletedTours] = useState<Record<string, boolean>>(
    () => user?.preferences?.completedTours ?? {},
  );
  const [activeTourId, setActiveTourId] = useState<string | null>(null);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string>(JSON.stringify(completedTours));

  // Sync from user preferences on initial load
  useEffect(() => {
    if (user?.preferences?.completedTours) {
      setCompletedTours(user.preferences.completedTours);
      lastPersistedRef.current = JSON.stringify(user.preferences.completedTours);
    }
  }, [user?.id]);

  // Debounced persist to server
  useEffect(() => {
    if (!client || !user?.id) return;

    const serialized = JSON.stringify(completedTours);
    if (serialized === lastPersistedRef.current) return;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    persistTimerRef.current = setTimeout(async () => {
      try {
        await client.service('users').patch(user!.id, {
          preferences: { ...user!.preferences, completedTours },
        });
        lastPersistedRef.current = serialized;
      } catch {
        // best-effort persistence
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [completedTours, client, user?.id]);

  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId);
  }, []);

  const completeTour = useCallback((tourId: string) => {
    setCompletedTours((prev) => ({ ...prev, [tourId]: true }));
    setActiveTourId(null);
  }, []);

  const resetTour = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const next = { ...prev };
      delete next[tourId];
      return next;
    });
    setActiveTourId(tourId);
  }, []);

  const resetAllTours = useCallback(() => {
    setCompletedTours({});
    setActiveTourId(null);
  }, []);

  const isTourCompleted = useCallback(
    (tourId: string) => !!completedTours[tourId],
    [completedTours],
  );

  const value: TourContextValue = {
    completedTours,
    activeTourId,
    startTour,
    completeTour,
    resetTour,
    resetAllTours,
    isTourCompleted,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

export const useTour = (): TourContextValue => {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return ctx;
};
