import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import tw from 'styledwind-native';
import { useAuth } from '../src/contexts/auth-context';

const LoadingScreen = tw.View`flex-1 items-center justify-center bg-[#69C6D8]`;

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LoadingScreen>
        <ActivityIndicator size="large" color="#fff" />
      </LoadingScreen>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
