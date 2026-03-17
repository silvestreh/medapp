import { Slot } from 'expo-router';
import { Provider } from 'styledwind-native';
import { AuthProvider } from '../src/contexts/auth-context';

export default function RootLayout() {
  return (
    <Provider initialColorScheme="light">
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </Provider>
  );
}
