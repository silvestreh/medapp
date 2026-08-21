import crypto from 'crypto';
import type { PaymentProvider } from '../../payment-provider';
import type {
  AuthorizationParams,
  Charge,
  CreateChargeParams,
  ExchangeParams,
  GetChargeParams,
  ProviderCredentials,
  ProviderEvent,
  RawWebhookRequest,
  Refund,
  RefundParams,
  WebhookVerification,
} from '../../domain';
import {
  createPreference,
  createRefund,
  exchangeOAuthCode,
  getPayment,
  refreshOAuthToken,
  MpTokenResponse,
} from './mercado-pago-client';
import { mapMpPaymentToCharge, minorUnitsToMpAmount } from './mercado-pago-mapper';

const MP_AUTHORIZATION_URL = 'https://auth.mercadopago.com/authorization';
// Reject webhook notifications whose signature timestamp is older than this.
const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

export interface MercadoPagoProviderConfig {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const toCredentials = (token: MpTokenResponse): ProviderCredentials => ({
  accessToken: token.access_token,
  refreshToken: token.refresh_token,
  providerAccountId: String(token.user_id),
  expiresAt: Number.isFinite(token.expires_in)
    ? new Date(Date.now() + token.expires_in * 1000)
    : null,
});

export class MercadoPagoProvider implements PaymentProvider {
  readonly id = 'mercado_pago';

  private config: MercadoPagoProviderConfig;

  constructor(config: MercadoPagoProviderConfig) {
    this.config = config;
  }

  getAuthorizationUrl(params: AuthorizationParams): string {
    const query = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      platform_id: 'mp',
      state: params.state,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${MP_AUTHORIZATION_URL}?${query.toString()}`;
  }

  async exchangeCode(params: ExchangeParams): Promise<ProviderCredentials> {
    const token = await exchangeOAuthCode(this.config, {
      code: params.code,
      redirectUri: params.redirectUri,
      codeVerifier: params.codeVerifier,
    });

    return toCredentials(token);
  }

  async refreshCredentials(credentials: ProviderCredentials): Promise<ProviderCredentials> {
    const token = await refreshOAuthToken(this.config, credentials.refreshToken);

    return toCredentials(token);
  }

  // Mercado Pago exposes no token-revocation endpoint; the caller deletes the
  // stored credentials, which is the only revocation available.
  async revoke(): Promise<void> {
    return undefined;
  }

  async createCharge(params: CreateChargeParams): Promise<Charge> {
    const preference = await createPreference(
      params.credentials.accessToken,
      {
        items: [{
          id: 'consulta',
          title: params.title,
          quantity: 1,
          unit_price: minorUnitsToMpAmount(params.amount.amount),
          currency_id: params.amount.currency,
        }],
        external_reference: params.externalReference,
        notification_url: params.notificationUrl,
        back_urls: params.backUrls,
        ...(params.expiresAt && {
          expires: true,
          expiration_date_to: params.expiresAt.toISOString(),
        }),
      },
      params.idempotencyKey
    );

    return {
      providerChargeId: preference.id,
      checkoutUrl: preference.init_point,
      status: 'pending',
      amount: params.amount,
      externalReference: params.externalReference,
      refundedAmount: null,
    };
  }

  async getCharge(params: GetChargeParams): Promise<Charge> {
    const payment = await getPayment(params.credentials.accessToken, params.providerPaymentId);

    return mapMpPaymentToCharge(payment);
  }

  async refundCharge(params: RefundParams): Promise<Refund> {
    const refund = await createRefund(
      params.credentials.accessToken,
      params.providerPaymentId,
      `refund:${params.providerPaymentId}`,
      params.amount != null ? minorUnitsToMpAmount(params.amount) : undefined
    );

    return {
      providerRefundId: String(refund.id),
      status: 'requested',
      amount: params.amount ?? null,
    };
  }

  verifyWebhook(request: RawWebhookRequest): WebhookVerification {
    if (!this.config.webhookSecret) {
      return { valid: false, reason: 'webhook secret not configured' };
    }

    const signatureHeader = headerValue(request.headers['x-signature']);
    const requestId = headerValue(request.headers['x-request-id']);

    if (!signatureHeader) {
      return { valid: false, reason: 'missing x-signature header' };
    }

    const parts = new Map<string, string>();
    for (const part of signatureHeader.split(',')) {
      const [key, ...rest] = part.split('=');
      if (key && rest.length > 0) {
        parts.set(key.trim(), rest.join('=').trim());
      }
    }

    const ts = parts.get('ts');
    const signature = parts.get('v1');

    if (!ts || !signature) {
      return { valid: false, reason: 'malformed x-signature header' };
    }

    // ts arrives in seconds; tolerate milliseconds defensively.
    const tsNumber = Number(ts);
    if (!Number.isFinite(tsNumber)) {
      return { valid: false, reason: 'invalid signature timestamp' };
    }
    const tsMs = tsNumber > 1e12 ? tsNumber : tsNumber * 1000;
    if (Math.abs(Date.now() - tsMs) > WEBHOOK_MAX_AGE_MS) {
      return { valid: false, reason: 'stale signature timestamp' };
    }

    const rawDataId = request.query['data.id'] ?? (request.body as any)?.data?.id;
    const dataId = rawDataId != null ? String(rawDataId).toLowerCase() : '';

    // Manifest template per Mercado Pago's spec; sections are only included
    // when their value is present.
    let manifest = '';
    if (dataId) manifest += `id:${dataId};`;
    if (requestId) manifest += `request-id:${requestId};`;
    manifest += `ts:${ts};`;

    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(manifest)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return { valid: false, reason: 'signature mismatch' };
    }

    return { valid: true };
  }

  parseWebhook(request: RawWebhookRequest): ProviderEvent {
    const body = (request.body ?? {}) as Record<string, any>;
    const topic = String(request.query.type ?? request.query.topic ?? body.type ?? '');
    const providerEventId = String(
      body.id ?? headerValue(request.headers['x-request-id']) ?? ''
    );
    const rawDataId = request.query['data.id'] ?? body.data?.id;

    if (topic === 'payment' && rawDataId != null) {
      return {
        kind: 'payment',
        providerEventId,
        topic,
        providerPaymentId: String(rawDataId),
        ...(body.user_id != null && { providerAccountId: String(body.user_id) }),
      };
    }

    return { kind: 'ignored', providerEventId, topic };
  }
}
