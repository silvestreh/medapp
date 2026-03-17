import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import tw from 'styledwind-native';
import { useAuth } from '../src/contexts/auth-context';
import { getPreAuthOnboardingDone, getPostAuthOnboardingDone } from '../src/preferences';

const LoadingScreen = tw.View`flex-1 items-center justify-center bg-[#69C6D8]`;

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const [preAuthDone, setPreAuthDone] = useState<boolean | null>(null);
  const [postAuthDone, setPostAuthDone] = useState<boolean | null>(null);

  useEffect(() => {
    getPreAuthOnboardingDone().then(setPreAuthDone);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      getPostAuthOnboardingDone().then(setPostAuthDone);
    }
  }, [isAuthenticated]);

  const loading = isLoading || preAuthDone === null || (isAuthenticated && postAuthDone === null);

  if (loading) {
    return (
      <LoadingScreen>
        <ActivityIndicator size="large" color="#fff" />
      </LoadingScreen>
    );
  }

  if (isAuthenticated) {
    if (!postAuthDone) {
      return <Redirect href="/(app)/onboarding" />;
    }
    return <Redirect href="/(app)" />;
  }

  if (!preAuthDone) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(auth)/login" />;
}
