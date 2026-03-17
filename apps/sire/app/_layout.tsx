import { Slot } from 'expo-router';
import { Provider } from 'styledwind-native';
import { AuthProvider } from '../src/contexts/auth-context';
import { PreferencesProvider } from '../src/contexts/preferences-context';

export default function RootLayout() {
  return (
    <Provider initialColorScheme="light">
      <AuthProvider>
        <PreferencesProvider>
          <Slot />
        </PreferencesProvider>
      </AuthProvider>
    </Provider>
  );
}
