import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSimpleMode,
  setSimpleMode as persistSimpleMode,
  getDoseReminders,
  setDoseReminders as persistDoseReminders,
} from '../preferences';

interface PreferencesState {
  simpleMode: boolean;
  doseReminders: boolean;
  toggleSimpleMode: () => void;
  toggleDoseReminders: (apiClient: any) => void;
}

const PreferencesContext = createContext<PreferencesState>({
  simpleMode: false,
  doseReminders: true,
  toggleSimpleMode: () => {},
  toggleDoseReminders: () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [simpleMode, setSimpleMode] = useState(false);
  const [doseReminders, setDoseReminders] = useState(true);

  useEffect(() => {
    getSimpleMode().then(setSimpleMode);
    getDoseReminders().then(setDoseReminders);
  }, []);

  const toggleSimpleMode = useCallback(() => {
    setSimpleMode((prev) => {
      const next = !prev;
      persistSimpleMode(next);
      return next;
    });
  }, []);

  const toggleDoseReminders = useCallback((apiClient: any) => {
    setDoseReminders((prev) => {
      const next = !prev;
      persistDoseReminders(next);
      // Sync with API (best-effort)
      apiClient?.service('sire-push-tokens').create({
        action: 'set-dose-reminders',
        doseReminders: next,
      }).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ simpleMode, doseReminders, toggleSimpleMode, toggleDoseReminders }),
    [simpleMode, doseReminders, toggleSimpleMode, toggleDoseReminders],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
