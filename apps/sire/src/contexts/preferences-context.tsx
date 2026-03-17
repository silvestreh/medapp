import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getSimpleMode, setSimpleMode as persistSimpleMode } from '../preferences';

interface PreferencesState {
  simpleMode: boolean;
  toggleSimpleMode: () => void;
}

const PreferencesContext = createContext<PreferencesState>({
  simpleMode: false,
  toggleSimpleMode: () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [simpleMode, setSimpleMode] = useState(false);

  useEffect(() => {
    getSimpleMode().then(setSimpleMode);
  }, []);

  const toggleSimpleMode = useCallback(() => {
    setSimpleMode((prev) => {
      const next = !prev;
      persistSimpleMode(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ simpleMode, toggleSimpleMode }), [simpleMode, toggleSimpleMode]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
