import { createContext, useContext, useReducer, type Dispatch, type ReactNode, useMemo } from 'react';
import type { BuilderState, BuilderAction } from './builder-types';
import { builderReducer } from './builder-reducer';
import { createEmptyBuilderState } from './utils/schema-serializer';

interface BuilderContextValue {
  state: BuilderState;
  dispatch: Dispatch<BuilderAction>;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

interface BuilderProviderProps {
  initialState?: BuilderState;
  formType?: 'encounter' | 'study';
  children: ReactNode;
}

export function BuilderProvider({ initialState, formType = 'encounter', children }: BuilderProviderProps) {
  const [state, dispatch] = useReducer(builderReducer, initialState ?? createEmptyBuilderState(formType));

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return ctx;
}
