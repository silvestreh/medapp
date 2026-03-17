import * as SecureStore from 'expo-secure-store';

const SIMPLE_MODE_KEY = 'sire_simple_mode';

export async function getSimpleMode(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(SIMPLE_MODE_KEY);
  return val === 'true';
}

export async function setSimpleMode(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(SIMPLE_MODE_KEY, String(enabled));
}
