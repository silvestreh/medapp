import * as SecureStore from 'expo-secure-store';
import { createClient } from './feathers-client';

const REFRESH_TOKEN_KEY = 'sire_refresh_token';
const PATIENT_DATA_KEY = 'sire_patient_data';

let accessToken: string | null = null;

const publicClient = createClient();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function requestOtp(documentNumber: string, slug: string) {
  return publicClient.service('patient-otp').create({
    action: 'request-otp',
    documentNumber,
    slug,
  });
}

export async function verifyOtp(documentNumber: string, code: string, slug: string) {
  const result = await publicClient.service('authentication').create({
    strategy: 'patient-otp',
    documentNumber,
    code,
    slug,
    app: 'sire',
  });

  accessToken = result.accessToken;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
  await SecureStore.setItemAsync(PATIENT_DATA_KEY, JSON.stringify(result.patient));

  return result;
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  try {
    const result = await publicClient.service('patient-refresh-tokens').create({
      action: 'refresh',
      refreshToken,
    });

    accessToken = result.accessToken;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
    await SecureStore.setItemAsync(PATIENT_DATA_KEY, JSON.stringify(result.patient));

    return true;
  } catch {
    await logout();
    return false;
  }
}

export async function getStoredPatient(): Promise<{ id: string; organizationId: string; name?: string } | null> {
  const data = await SecureStore.getItemAsync(PATIENT_DATA_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function hasRefreshToken(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return !!token;
}

export async function logout() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(PATIENT_DATA_KEY);
}

export async function listOrganizations() {
  const result = await publicClient.service('patient-otp').create({
    action: 'list-organizations',
  });
  return (result as any).organizations || [];
}
