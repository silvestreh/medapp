import { useEffect } from 'react';
import { Stack, Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import tw from 'styledwind-native';
import { useAuth } from '../../src/contexts/auth-context';
import {
  configureNotificationHandler,
  setupAndroidChannel,
  setupNotificationCategories,
  requestPermissions,
  getNotificationsEnabled,
  setNotificationsEnabled,
} from '../../src/notifications';

const LoadingView = tw.View`flex-1 items-center justify-center`;

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    async function initNotifications() {
      configureNotificationHandler();
      await setupAndroidChannel();
      await setupNotificationCategories();

      const alreadyEnabled = await getNotificationsEnabled();
      if (!alreadyEnabled) {
        const granted = await requestPermissions();
        if (granted) {
          await setNotificationsEnabled(true);
        }
      }
    }
    if (isAuthenticated) {
      initNotifications();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <LoadingView>
        <ActivityIndicator size="large" color="#69C6D8" />
      </LoadingView>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen
        name="settings"
        options={{
          presentation: 'transparentModal',
          headerShown: false,
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
