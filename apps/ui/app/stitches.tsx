import { createStitches } from '@stitches/react';
import { createContext, useState, useCallback } from 'react';

interface ClientStyleContextData {
  reset: () => void;
  sheet: string;
}

interface ClientCacheProviderProps {
  children: React.ReactNode;
}

export const media = {
  sm: '(min-width: 320px)',
  md: '(min-width: 640px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1440px)',
};

export const { getCssText, styled } = createStitches({
  media,
});

const ClientStyleContext = createContext<ClientStyleContextData>({
  reset: () => {},
  sheet: '',
});

export function ClientCacheProvider({ children }: ClientCacheProviderProps) {
  const [sheet, setSheet] = useState(getCssText());

  const reset = useCallback(() => {
    setSheet(getCssText());
  }, []);

  return <ClientStyleContext.Provider value={{ reset, sheet }}>{children}</ClientStyleContext.Provider>;
}
