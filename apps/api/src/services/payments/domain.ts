// Provider-agnostic payment domain types. Booking, webhooks, crons, and the
// UI-facing services speak ONLY these types — all provider-specific vocabulary
// (Mercado Pago payloads, statuses, endpoints) stays inside the provider
// adapters under ./providers/*.

export type PaymentProviderId = 'mercado_pago';

export type PaymentStatus =
  | 'pending'
  | 'in_process'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'refunded'
  | 'charged_back';

export type AppointmentStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'expired';

// Amounts are ALWAYS integer minor units (centavos). Never floats.
export interface Money {
  amount: number;
  currency: string;
}

export interface ProviderCredentials {
  accessToken: string;
  refreshToken: string;
  providerAccountId: string;
  expiresAt: Date | null;
}

export interface AuthorizationParams {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface ExchangeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface CreateChargeParams {
  credentials: ProviderCredentials;
  amount: Money;
  // Opaque correlation id (appointment_payments.id). Never patient data.
  externalReference: string;
  idempotencyKey: string;
  // Generic, non-identifying item title (e.g. "Consulta médica").
  title: string;
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
  notificationUrl: string;
  expiresAt?: Date | null;
}

export interface Charge {
  // Preference/checkout id at creation time; payment id when fetched back.
  providerChargeId: string;
  checkoutUrl: string | null;
  status: PaymentStatus;
  amount: Money | null;
  externalReference: string | null;
  refundedAmount: number | null;
}

export interface GetChargeParams {
  credentials: ProviderCredentials;
  providerPaymentId: string;
}

export interface RefundParams {
  credentials: ProviderCredentials;
  providerPaymentId: string;
  // Minor units; omit for a full refund.
  amount?: number;
}

export interface Refund {
  providerRefundId: string;
  status: 'requested' | 'completed' | 'failed';
  amount: number | null;
}

export interface RawWebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  rawBody: string;
  body: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  reason?: string;
}

export interface ProviderEvent {
  kind: 'payment' | 'ignored';
  providerEventId: string;
  topic: string;
  providerPaymentId?: string;
  // Provider-side seller account id, when the notification carries it — used
  // to locate the professional's credentials on first contact.
  providerAccountId?: string;
}
