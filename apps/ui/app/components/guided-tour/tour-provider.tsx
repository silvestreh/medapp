import React, { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from 'react';

import { useFeathers, useAccount } from '~/components/provider';

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

async function persistCompletedTours(
  client: ReturnType<typeof useFeathers>,
  userId: string,
  completedTours: Record<string, boolean>
) {
  try {
    await client.service('users').patch(userId, {
      preferences: { completedTours },
    } as any);
  } catch (err) {
    console.error('[tour] Failed to persist completedTours:', err);
  }
}

export const TourProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const client = useFeathers();
  const { user } = useAccount();

  const [completedTours, setCompletedTours] = useState<Record<string, boolean>>(
    () => user?.preferences?.completedTours ?? {}
  );
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const startTour = useCallback((tourId: string) => {
    setActiveTourId(tourId);
  }, []);

  const completeTour = useCallback(
    (tourId: string) => {
      setCompletedTours(prev => {
        const next = { ...prev, [tourId]: true };
        if (userIdRef.current) {
          persistCompletedTours(client, userIdRef.current, next);
        }
        return next;
      });
      setActiveTourId(null);
    },
    [client]
  );

  const resetTour = useCallback(
    (tourId: string) => {
      setCompletedTours(prev => {
        const next = { ...prev };
        delete next[tourId];
        if (userIdRef.current) {
          persistCompletedTours(client, userIdRef.current, next);
        }
        return next;
      });
      setActiveTourId(tourId);
    },
    [client]
  );

  const resetAllTours = useCallback(() => {
    setCompletedTours({});
    if (userIdRef.current) {
      persistCompletedTours(client, userIdRef.current, {});
    }
    setActiveTourId(null);
  }, [client]);

  const isTourCompleted = useCallback((tourId: string) => !!completedTours[tourId], [completedTours]);

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
