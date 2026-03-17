import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../api/feathers-client';
import {
  getAccessToken,
  setAccessToken,
  refreshAccessToken,
  hasRefreshToken,
  getStoredPatient,
  logout as authLogout,
  requestOtp as authRequestOtp,
  verifyOtp as authVerifyOtp,
} from '../api/auth';
import { getExpoPushToken } from '../notifications';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  patient: { id: string; organizationId: string; name?: string } | null;
  apiClient: ReturnType<typeof createClient>;
  login: (documentNumber: string, code: string, slug: string) => Promise<void>;
  requestOtp: (documentNumber: string, slug: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [patient, setPatient] = useState<{ id: string; organizationId: string; name?: string } | null>(null);

  const apiClient = useMemo(() => {
    const token = getAccessToken();
    return createClient(token || undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    async function tryRestore() {
      const hasToken = await hasRefreshToken();
      if (!hasToken) {
        setIsLoading(false);
        return;
      }

      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const storedPatient = await getStoredPatient();
        setPatient(storedPatient);
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    }

    tryRestore();
  }, []);

  const requestOtp = useCallback(async (documentNumber: string, slug: string) => {
    return authRequestOtp(documentNumber, slug);
  }, []);

  const login = useCallback(async (documentNumber: string, code: string, slug: string) => {
    const result = await authVerifyOtp(documentNumber, code, slug);
    setPatient(result.patient);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    console.log('[Auth] logout: starting');
    try {
      console.log('[Auth] logout: getting push token...');
      const pushToken = await getExpoPushToken();
      console.log('[Auth] logout: push token =', pushToken);
      if (pushToken) {
        console.log('[Auth] logout: unregistering push token...');
        await apiClient.service('sire-push-tokens').create({
          action: 'unregister',
          token: pushToken,
        });
        console.log('[Auth] logout: push token unregistered');
      }
    } catch (err) {
      console.warn('[Auth] logout: push token cleanup failed:', err);
    }
    console.log('[Auth] logout: clearing auth state...');
    await authLogout();
    setAccessToken(null);
    setPatient(null);
    setIsAuthenticated(false);
    console.log('[Auth] logout: done');
  }, [apiClient]);

  const value = useMemo(
    () => ({ isAuthenticated, isLoading, patient, apiClient, login, requestOtp, logout }),
    [isAuthenticated, isLoading, patient, apiClient, login, requestOtp, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
