import crypto from 'crypto';
import { BadRequest, NotFound, Unavailable } from '@feathersjs/errors';
import type { Id, Params } from '@feathersjs/feathers';
import type { Application } from '../../declarations';
import type { ProviderCredentials } from '../payments/domain';
import { getProvider } from '../payments/provider-registry';
import { getPaymentsConfig, isPaymentsConfigured } from '../../utils/payments-config';
import logger from '../../logger';

// Custom (non-sequelize) service in the llm-api-keys style: the ciphertext
// columns are never selected on any externally reachable path — external
// callers only ever see the non-sensitive connection hint. Decryption happens
// exclusively through getDecryptedCredentials(), which is not a Feathers
// method and is only called by server-side code (booking, webhooks, cron).

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const SAFE_ATTRIBUTES = [
  'provider',
  'status',
  'providerAccountId',
  'accountHint',
  'expiresAt',
  'lastRefreshedAt',
];

export interface PaymentConnectionPublic {
  connected: boolean;
  provider: string;
  status: 'connected' | 'refresh_failed' | 'disconnected';
  providerAccountId: string | null;
  accountHint: string | null;
  expiresAt: Date | null;
  lastRefreshedAt: Date | null;
}

export interface DecryptedConnection extends ProviderCredentials {
  provider: string;
  status: 'connected' | 'refresh_failed' | 'disconnected';
  refreshFailCount: number;
}

export interface ClaimedOauthState {
  userId: string;
  provider: string;
  codeVerifier: string;
}

const bufferToString = (value: unknown): string =>
  Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');

export class PaymentConnections {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  private get model(): any {
    return this.app.get('sequelizeClient').models.payment_connections;
  }

  private get stateModel(): any {
    return this.app.get('sequelizeClient').models.payment_oauth_states;
  }

  getRedirectUri(): string {
    return `${getPaymentsConfig(this.app).publicUrl}/payments/oauth/callback`;
  }

  async get(id: Id, params: Params): Promise<PaymentConnectionPublic> {
    if (id !== 'current') {
      throw new NotFound('Use get(\'current\') to read your connection state');
    }

    const userId = params.user?.id;

    if (!userId) {
      throw new BadRequest('Authenticated user required');
    }

    const row = await this.model.findOne({
      where: { userId },
      attributes: SAFE_ATTRIBUTES,
      raw: true,
    });

    if (!row) {
      return {
        connected: false,
        provider: 'mercado_pago',
        status: 'disconnected',
        providerAccountId: null,
        accountHint: null,
        expiresAt: null,
        lastRefreshedAt: null,
      };
    }

    return { connected: row.status === 'connected', ...row };
  }

  async create(data: { action?: string; provider?: string }, params: Params): Promise<{ authorizationUrl: string }> {
    if (data?.action !== 'start') {
      throw new BadRequest('Unknown action');
    }

    if (!isPaymentsConfigured(this.app)) {
      throw new Unavailable('Payments are not configured');
    }

    const userId = params.user?.id;

    if (!userId) {
      throw new BadRequest('Authenticated user required');
    }

    const providerId = data.provider ?? 'mercado_pago';
    const provider = getProvider(providerId);

    // Cryptographically random, single-use, short-lived state bound to this
    // professional — the callback trusts ONLY the state row for identity.
    const state = crypto.randomBytes(32).toString('base64url');
    const codeVerifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    await this.stateModel.create({
      state,
      userId,
      provider: providerId,
      codeVerifier,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    });

    const authorizationUrl = provider.getAuthorizationUrl({
      state,
      codeChallenge,
      redirectUri: this.getRedirectUri(),
    });

    return { authorizationUrl };
  }

  async remove(id: Id, params: Params): Promise<PaymentConnectionPublic> {
    if (id !== 'current') {
      throw new NotFound('Use remove(\'current\') to disconnect');
    }

    const userId = params.user?.id;

    if (!userId) {
      throw new BadRequest('Authenticated user required');
    }

    const connection = await this.getDecryptedCredentials(String(userId));

    if (connection) {
      try {
        await getProvider(connection.provider).revoke(connection);
      } catch (error: any) {
        logger.warn('Payment connection upstream revoke failed: %s', error?.message);
      }
    }

    await this.model.destroy({ where: { userId } });
    this.logConnectionEvent(params, 'disconnect');

    return this.get('current', params);
  }

  // ---------------------------------------------------------------------
  // Internal server-side surface — NOT part of the Feathers method set.
  // ---------------------------------------------------------------------

  async getDecryptedCredentials(userId: string): Promise<DecryptedConnection | null> {
    const model = this.model;
    const row = await model.findOne({
      where: { userId },
      attributes: model.decryptedAttributes,
      raw: true,
    });

    if (!row) {
      return null;
    }

    return {
      accessToken: bufferToString(row.accessToken),
      refreshToken: bufferToString(row.refreshToken),
      providerAccountId: row.providerAccountId ?? '',
      expiresAt: row.expiresAt ?? null,
      provider: row.provider,
      status: row.status,
      refreshFailCount: row.refreshFailCount ?? 0,
    };
  }

  async storeCredentials(
    userId: string,
    providerId: string,
    credentials: ProviderCredentials,
    options: { logEvent?: boolean } = {}
  ): Promise<void> {
    const accountHint = credentials.providerAccountId
      ? `MP ****${credentials.providerAccountId.slice(-4)}`
      : null;

    const payload = {
      status: 'connected',
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      providerAccountId: credentials.providerAccountId || null,
      accountHint,
      expiresAt: credentials.expiresAt,
      lastRefreshedAt: new Date(),
      refreshFailCount: 0,
      nextRefreshRetry: null,
    };

    const existing = await this.model.findOne({
      where: { userId, provider: providerId },
      attributes: ['id'],
      raw: true,
    });

    if (existing) {
      await this.model.update(payload, { where: { id: existing.id } });
    } else {
      await this.model.create({ userId, provider: providerId, ...payload });
    }

    if (options.logEvent !== false) {
      this.logConnectionEvent({ userId }, 'connect', userId);
    }
  }

  async markConnectionStatus(
    userId: string,
    status: 'connected' | 'refresh_failed' | 'disconnected',
    extra: Record<string, unknown> = {}
  ): Promise<void> {
    await this.model.update({ status, ...extra }, { where: { userId } });
  }

  // Atomically claims a single-use OAuth state row: exactly one concurrent
  // callback can win it, and expired or already-used states never match.
  async claimOauthState(state: string): Promise<ClaimedOauthState | null> {
    const sequelize = this.app.get('sequelizeClient');
    const [rows] = await sequelize.query(
      `UPDATE "payment_oauth_states" SET "usedAt" = NOW()
       WHERE "state" = :state AND "usedAt" IS NULL AND "expiresAt" > NOW()
       RETURNING "userId", "provider"`,
      { replacements: { state } }
    ) as [Array<{ userId: string; provider: string }>, unknown];

    if (!rows.length) {
      return null;
    }

    const stateModel = this.stateModel;
    const row = await stateModel.findOne({
      where: { state },
      attributes: stateModel.decryptedAttributes,
      raw: true,
    });

    return {
      userId: rows[0].userId,
      provider: rows[0].provider,
      codeVerifier: bufferToString(row?.codeVerifier),
    };
  }

  private logConnectionEvent(params: Params | { userId: string }, event: string, userId?: string): void {
    const resolvedUserId = userId ?? (params as Params).user?.id ?? (params as { userId: string }).userId;
    const organizationId = (params as Params).organizationId ?? null;

    this.app.service('access-logs').create({
      userId: resolvedUserId,
      organizationId,
      resource: 'payment-connection',
      action: event === 'connect' ? 'grant' : 'write',
      purpose: 'billing',
      patientId: null,
      metadata: { event },
    }, { provider: undefined }).catch(() => undefined);
  }
}
