import { useEffect } from 'react';
import { Stack, Redirect } from 'expo-router';
import { ActivityIndicator, Platform } from 'react-native';
import tw from 'styledwind-native';
import { useAuth } from '../../src/contexts/auth-context';
import {
  configureNotificationHandler,
  setupAndroidChannel,
  setupNotificationCategories,
  requestPermissions,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getExpoPushToken,
} from '../../src/notifications';

const LoadingView = tw.View`flex-1 items-center justify-center`;

export default function AppLayout() {
  const { isAuthenticated, isLoading, apiClient } = useAuth();

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

      // Register push token with the API
      const pushToken = await getExpoPushToken();
      if (pushToken) {
        try {
          await apiClient.service('sire-push-tokens').create({
            action: 'register',
            token: pushToken,
            platform: Platform.OS,
          });
        } catch (err) {
          console.warn('Failed to register push token:', err);
        }
      }
    }
    if (isAuthenticated) {
      initNotifications();
    }
  }, [isAuthenticated, apiClient]);

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
