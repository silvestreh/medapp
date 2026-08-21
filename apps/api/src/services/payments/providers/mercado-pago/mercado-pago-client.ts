import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { MpPaymentResponse } from './mercado-pago-mapper';
import type { ProviderErrorContext } from '../../domain';
import { sanitizeForLog } from '../../../../utils/sanitize-for-log';

// Typed HTTP wrapper for the Mercado Pago API, in the recetario-client style:
// every request goes through handleRequest, errors carry a sanitized context,
// and tests can swap the transport with setMercadoPagoRequestImplForTesting.

const MP_API_URL = 'https://api.mercadopago.com';
const REQUEST_TIMEOUT_MS = 30_000;

export interface MpTokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: number | string;
  expires_in: number;
  scope?: string;
}

export interface MpPreferencePayload {
  items: {
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: string;
  }[];
  external_reference: string;
  notification_url: string;
  back_urls: {
    success: string;
    failure: string;
    pending: string;
  };
  expires?: boolean;
  expiration_date_to?: string;
}

export interface MpPreferenceResponse {
  id: string;
  init_point: string;
}

export interface MpRefundResponse {
  id: number | string;
  status?: string;
  amount?: number;
}

type MpRequestImpl = (config: AxiosRequestConfig) => Promise<{ data: unknown }>;

const defaultRequestImpl: MpRequestImpl = (config) =>
  axios.request({ baseURL: MP_API_URL, timeout: REQUEST_TIMEOUT_MS, ...config });

let requestImpl: MpRequestImpl = defaultRequestImpl;

export function setMercadoPagoRequestImplForTesting(impl: MpRequestImpl | null): void {
  requestImpl = impl ?? defaultRequestImpl;
}

async function handleRequest<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await requestImpl(config);
    return response.data as T;
  } catch (error) {
    const axiosError = error as AxiosError<any>;
    const message =
      axiosError.response?.data?.message ??
      axiosError.response?.data?.error ??
      axiosError.message ??
      'Mercado Pago API error';
    const status = axiosError.response?.status ?? 500;

    // Never let credentials or OAuth material reach logs, thrown errors, or Sentry.
    const providerContext: ProviderErrorContext = {
      provider: 'mercado_pago',
      method: String(config.method ?? 'get').toUpperCase(),
      url: String(config.url ?? ''),
      responseStatus: axiosError.response?.status,
      responseBody: sanitizeForLog(axiosError.response?.data),
    };

    throw Object.assign(new Error(`MercadoPago: ${message}`), { status, providerContext });
  }
}

export interface MpOAuthAppConfig {
  clientId: string;
  clientSecret: string;
}

export function exchangeOAuthCode(
  appConfig: MpOAuthAppConfig,
  params: { code: string; redirectUri: string; codeVerifier: string }
): Promise<MpTokenResponse> {
  return handleRequest<MpTokenResponse>({
    method: 'post',
    url: '/oauth/token',
    headers: { Accept: 'application/json' },
    data: {
      client_id: appConfig.clientId,
      client_secret: appConfig.clientSecret,
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    },
  });
}

export function refreshOAuthToken(
  appConfig: MpOAuthAppConfig,
  refreshToken: string
): Promise<MpTokenResponse> {
  return handleRequest<MpTokenResponse>({
    method: 'post',
    url: '/oauth/token',
    headers: { Accept: 'application/json' },
    data: {
      client_id: appConfig.clientId,
      client_secret: appConfig.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
  });
}

export function createPreference(
  accessToken: string,
  payload: MpPreferencePayload,
  idempotencyKey: string
): Promise<MpPreferenceResponse> {
  return handleRequest<MpPreferenceResponse>({
    method: 'post',
    url: '/checkout/preferences',
    data: payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
  });
}

export function getPayment(accessToken: string, paymentId: string): Promise<MpPaymentResponse> {
  return handleRequest<MpPaymentResponse>({
    method: 'get',
    url: `/v1/payments/${encodeURIComponent(paymentId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export interface MpUser {
  id: number | string;
  nickname?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export function getUser(accessToken: string): Promise<MpUser> {
  return handleRequest<MpUser>({
    method: 'get',
    url: '/users/me',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function createRefund(
  accessToken: string,
  paymentId: string,
  idempotencyKey: string,
  amountPesos?: number
): Promise<MpRefundResponse> {
  return handleRequest<MpRefundResponse>({
    method: 'post',
    url: `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
    data: amountPesos ? { amount: amountPesos } : {},
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Idempotency-Key': idempotencyKey,
    },
  });
}
