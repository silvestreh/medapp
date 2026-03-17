import * as SecureStore from 'expo-secure-store';

const SIMPLE_MODE_KEY = 'sire_simple_mode';
const DOSE_REMINDERS_KEY = 'sire_dose_reminders';
const PRE_AUTH_ONBOARDING_KEY = 'sire_pre_auth_onboarding_done';
const POST_AUTH_ONBOARDING_KEY = 'sire_post_auth_onboarding_done';

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

export async function getPreAuthOnboardingDone(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(PRE_AUTH_ONBOARDING_KEY);
  return val === 'true';
}

export async function setPreAuthOnboardingDone(): Promise<void> {
  await SecureStore.setItemAsync(PRE_AUTH_ONBOARDING_KEY, 'true');
}

export async function getPostAuthOnboardingDone(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(POST_AUTH_ONBOARDING_KEY);
  return val === 'true';
}

export async function setPostAuthOnboardingDone(): Promise<void> {
  await SecureStore.setItemAsync(POST_AUTH_ONBOARDING_KEY, 'true');
}
