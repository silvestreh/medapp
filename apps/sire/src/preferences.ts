import * as SecureStore from 'expo-secure-store';

const SIMPLE_MODE_KEY = 'sire_simple_mode';
const DOSE_REMINDERS_KEY = 'sire_dose_reminders';

export async function getSimpleMode(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(SIMPLE_MODE_KEY);
  return val === 'true';
}

export async function setSimpleMode(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(SIMPLE_MODE_KEY, String(enabled));
}

export async function getDoseReminders(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(DOSE_REMINDERS_KEY);
  // Default to true (enabled) if never set
  return val !== 'false';
}

export async function setDoseReminders(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(DOSE_REMINDERS_KEY, String(enabled));
}
