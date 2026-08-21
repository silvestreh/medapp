import type { Application } from '../declarations';

// Central reader for the `payments` config block. @feathersjs/configuration
// substitutes values that name an env var (e.g. "PAYMENTS_ENCRYPTION_KEY")
// with that env var's value — but leaves the literal name in place when the
// env var is unset, so a value equal to its own env-var name means "not set".

export interface MercadoPagoConfig {
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
}

export interface PaymentsConfig {
  encryptionKey?: string;
  // Public base URL of the API (OAuth callback + webhook notification URL).
  publicUrl?: string;
  // Base URL of the professional UI (post-OAuth redirect target).
  uiUrl?: string;
  // Patient booking app base URL for checkout back_urls. Supports a {slug}
  // placeholder for the organization slug, e.g. "https://{slug}.turnos.athel.as"
  // or "https://turnos.athel.as/{slug}".
  bookingUrl?: string;
  mercadoPago: MercadoPagoConfig;
}

// A value still equal to its own env-var name is the unsubstituted placeholder.
const resolve = (value: unknown, envVar: string): string | undefined => {
  if (typeof value === 'string' && value && value !== envVar) {
    return value;
  }

  return process.env[envVar] || undefined;
};

export function getPaymentsConfig(app: Application): PaymentsConfig {
  const raw = (app.get('payments') || {}) as Record<string, any>;
  const rawMp = (raw.mercadoPago || {}) as Record<string, any>;

  return {
    encryptionKey: resolve(raw.encryptionKey, 'PAYMENTS_ENCRYPTION_KEY'),
    publicUrl: resolve(raw.publicUrl, 'API_PUBLIC_URL'),
    uiUrl: resolve(raw.uiUrl, 'APP_URL'),
    bookingUrl: resolve(raw.bookingUrl, 'BOOKING_PUBLIC_URL'),
    mercadoPago: {
      clientId: resolve(rawMp.clientId, 'MP_CLIENT_ID'),
      clientSecret: resolve(rawMp.clientSecret, 'MP_CLIENT_SECRET'),
      webhookSecret: resolve(rawMp.webhookSecret, 'MP_WEBHOOK_SECRET'),
    },
  };
}

export function isPaymentsConfigured(app: Application): boolean {
  return Boolean(getPaymentsConfig(app).mercadoPago.clientId);
}
