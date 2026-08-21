import assert from 'assert';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { setProviderForTesting, resetProvidersForTesting } from '../../src/services/payments/provider-registry';
import type { PaymentProvider } from '../../src/services/payments/payment-provider';
import type { ProviderCredentials } from '../../src/services/payments/domain';
import { refreshPaymentTokens } from '../../src/cron/payment-token-refresh';
import type { PaymentConnections } from '../../src/services/payment-connections/payment-connections.class';

// Expires inside the 30-day refresh-ahead window, so the cron picks it up.
const SOON = () => new Date(Date.now() + 10 * 24 * 3600 * 1000);

describe('payment token refresh cron', function () {
  this.timeout(20000);

  let org: any;
  let refreshImpl: (credentials: ProviderCredentials) => Promise<ProviderCredentials>;

  const service = (): PaymentConnections =>
    app.service('payment-connections') as unknown as PaymentConnections;

  const fakeProvider: PaymentProvider = {
    id: 'mercado_pago',
    getAuthorizationUrl: () => 'https://fake.mp/authorization',
    async exchangeCode() {
      throw new Error('not used');
    },
    refreshCredentials(credentials) {
      return refreshImpl(credentials);
    },
    async revoke() { return undefined; },
    async createCharge() { throw new Error('not used'); },
    async getCharge() { throw new Error('not used'); },
    async refundCharge() { throw new Error('not used'); },
    verifyWebhook() { return { valid: true }; },
    parseWebhook() { return { kind: 'ignored', providerEventId: 'x', topic: 'x' }; },
  };

  const makeConnectedMedic = async (tag: string) => {
    const stamp = `${Date.now()}-${tag}`;
    const medic = await createTestUser({
      username: `pay.refresh.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });

    await service().storeCredentials(String(medic.id), 'mercado_pago', {
      accessToken: `token-${tag}`,
      refreshToken: `refresh-${tag}`,
      providerAccountId: '987654321',
      expiresAt: SOON(),
    }, { logEvent: false });

    return medic;
  };

  before(async () => {
    org = await createTestOrganization({ slug: `pay-refresh-${Date.now()}` });
    setProviderForTesting('mercado_pago', fakeProvider);
  });

  after(() => {
    resetProvidersForTesting();
  });

  it('rotates the token pair on success and keeps the connection healthy', async () => {
    const medic = await makeConnectedMedic('ok');
    refreshImpl = async (credentials) => ({
      accessToken: `${credentials.accessToken}-v2`,
      refreshToken: `${credentials.refreshToken}-v2`,
      providerAccountId: credentials.providerAccountId,
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
    });

    await refreshPaymentTokens(app, { jitter: false });

    const connection = await service().getDecryptedCredentials(String(medic.id));
    assert.strictEqual(connection?.accessToken, 'token-ok-v2');
    assert.strictEqual(connection?.refreshToken, 'refresh-ok-v2');
    assert.strictEqual(connection?.status, 'connected');
    assert.strictEqual(connection?.refreshFailCount, 0);
  });

  it('backs off with refresh_failed on a transient failure', async () => {
    const medic = await makeConnectedMedic('transient');
    refreshImpl = async () => {
      throw new Error('MercadoPago: gateway timeout');
    };

    await refreshPaymentTokens(app, { jitter: false });

    const connection = await service().getDecryptedCredentials(String(medic.id));
    assert.strictEqual(connection?.status, 'refresh_failed');
    assert.strictEqual(connection?.refreshFailCount, 1);
    // Still refreshable: the original tokens are untouched.
    assert.strictEqual(connection?.accessToken, 'token-transient');
  });

  it('disconnects immediately when the grant is revoked', async () => {
    const medic = await makeConnectedMedic('revoked');
    refreshImpl = async () => {
      throw new Error('MercadoPago: invalid_grant');
    };

    await refreshPaymentTokens(app, { jitter: false });

    const connection = await service().getDecryptedCredentials(String(medic.id));
    assert.strictEqual(connection?.status, 'disconnected');
  });

  it('disconnects after exhausting the retry budget', async () => {
    const medic = await makeConnectedMedic('exhausted');
    refreshImpl = async () => {
      throw new Error('MercadoPago: gateway timeout');
    };

    // Force retries to be due immediately instead of waiting out the backoff.
    for (let i = 0; i < 5; i++) {
      await refreshPaymentTokens(app, { jitter: false });
      await service().markConnectionStatus(String(medic.id), (
        await service().getDecryptedCredentials(String(medic.id))
      )?.status ?? 'refresh_failed', { nextRefreshRetry: null });
    }

    const connection = await service().getDecryptedCredentials(String(medic.id));
    assert.strictEqual(connection?.status, 'disconnected');
  });
});
