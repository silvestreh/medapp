import assert from 'assert';
import { QueryTypes, Sequelize } from 'sequelize';
import app from '../../src/app';
import { createTestUser, createTestOrganization } from '../test-helpers';
import { setProviderForTesting, resetProvidersForTesting } from '../../src/services/payments/provider-registry';
import type { PaymentProvider } from '../../src/services/payments/payment-provider';
import type { ProviderCredentials } from '../../src/services/payments/domain';
import paymentOauthCallbackHandler from '../../src/middleware/payment-oauth-callback';

const FAKE_ACCESS_TOKEN = 'fake-access-token-abc123';
const FAKE_REFRESH_TOKEN = 'fake-refresh-token-def456';

interface FakeCalls {
  exchange: { code: string; codeVerifier: string; redirectUri: string }[];
  revoke: number;
}

const makeFakeProvider = (calls: FakeCalls): PaymentProvider => ({
  id: 'mercado_pago',
  getAuthorizationUrl: ({ state, codeChallenge, redirectUri }) =>
    `https://fake.mp/authorization?state=${state}&code_challenge=${codeChallenge}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  async exchangeCode(params) {
    calls.exchange.push(params);
    const credentials: ProviderCredentials = {
      accessToken: FAKE_ACCESS_TOKEN,
      refreshToken: FAKE_REFRESH_TOKEN,
      providerAccountId: '123456789',
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      accountLabel: 'seller@testuser.com',
    };
    return credentials;
  },
  async refreshCredentials(credentials) {
    return { ...credentials, accessToken: `${credentials.accessToken}-refreshed` };
  },
  async revoke() {
    calls.revoke += 1;
  },
  async createCharge() {
    throw new Error('not used in this test');
  },
  async getCharge() {
    throw new Error('not used in this test');
  },
  async refundCharge() {
    throw new Error('not used in this test');
  },
  verifyWebhook() {
    return { valid: true };
  },
  parseWebhook() {
    return { kind: 'ignored', providerEventId: 'x', topic: 'x' };
  },
});

interface FakeRes {
  redirects: string[];
}

const makeRes = (): FakeRes & { redirect: (status: number, url: string) => void } => {
  const res = {
    redirects: [] as string[],
    redirect(_status: number, url: string) {
      res.redirects.push(url);
    },
  };
  return res;
};

describe('\'payment-connections\' service and OAuth flow', function () {
  this.timeout(20000);

  let org: any;
  let medic: any;
  let calls: FakeCalls;

  const asProvider = (user: any, organizationId?: string, extra: Record<string, any> = {}) => ({
    provider: 'rest',
    authenticated: true,
    user,
    ...(organizationId ? { organizationId } : {}),
    ...extra,
  } as any);

  const callbackHandler = paymentOauthCallbackHandler(app);

  before(async () => {
    const stamp = Date.now();
    org = await createTestOrganization({ slug: `pay-conn-${stamp}` });
    medic = await createTestUser({
      username: `pay.conn.${stamp}@test.com`,
      password: 'SuperSecret1!',
      roleIds: ['medic'],
      organizationId: org.id,
    });
  });

  beforeEach(() => {
    calls = { exchange: [], revoke: 0 };
    setProviderForTesting('mercado_pago', makeFakeProvider(calls));
  });

  after(() => {
    resetProvidersForTesting();
  });

  const startOauth = async (): Promise<string> => {
    const result = await app.service('payment-connections').create(
      { action: 'start' },
      asProvider(medic, org.id)
    ) as { authorizationUrl: string };

    const url = new URL(result.authorizationUrl);
    const state = url.searchParams.get('state');
    assert.ok(state, 'authorization URL must carry the state');
    return state as string;
  };

  it('starts the flow with a persisted, encrypted, single-use state', async () => {
    const state = await startOauth();

    const sequelize: Sequelize = app.get('sequelizeClient');
    const [row] = await sequelize.query(
      'SELECT "userId", "codeVerifier", "usedAt", "expiresAt" FROM "payment_oauth_states" WHERE "state" = :state',
      { replacements: { state }, type: QueryTypes.SELECT }
    ) as any[];

    assert.ok(row, 'state row must be persisted');
    assert.strictEqual(row.userId, medic.id);
    assert.strictEqual(row.usedAt, null);
    assert.ok(new Date(row.expiresAt).getTime() > Date.now());
    // The verifier is stored pgcrypto-encrypted, never as plaintext.
    assert.ok(Buffer.isBuffer(row.codeVerifier));
  });

  it('completes the callback, stores encrypted credentials, and exposes only the hint', async () => {
    const state = await startOauth();
    const res = makeRes();

    await callbackHandler({ query: { code: 'auth-code-1', state } }, res);

    assert.strictEqual(res.redirects.length, 1);
    assert.match(res.redirects[0], /settings\/payments\?connected=1$/);
    assert.strictEqual(calls.exchange.length, 1);
    assert.strictEqual(calls.exchange[0].code, 'auth-code-1');
    assert.ok(calls.exchange[0].codeVerifier, 'exchange must receive the PKCE verifier');

    // Tokens are ciphertext at rest.
    const sequelize: Sequelize = app.get('sequelizeClient');
    const [row] = await sequelize.query(
      'SELECT "accessToken", "refreshToken" FROM "payment_connections" WHERE "userId" = :userId',
      { replacements: { userId: medic.id }, type: QueryTypes.SELECT }
    ) as any[];
    assert.ok(Buffer.isBuffer(row.accessToken));
    assert.ok(!row.accessToken.toString('utf8').includes(FAKE_ACCESS_TOKEN));
    assert.ok(!row.refreshToken.toString('utf8').includes(FAKE_REFRESH_TOKEN));

    // The public read never exposes tokens — only the non-sensitive hint.
    const current = await app.service('payment-connections').get('current', asProvider(medic, org.id)) as any;
    assert.strictEqual(current.connected, true);
    assert.strictEqual(current.status, 'connected');
    // Recognizable label from the connect-time account fetch, not the bare id.
    assert.strictEqual(current.accountHint, 'seller@testuser.com');
    assert.strictEqual(current.accessToken, undefined);
    assert.strictEqual(current.refreshToken, undefined);
    assert.ok(!JSON.stringify(current).includes(FAKE_ACCESS_TOKEN));

    // The internal decrypt path round-trips the original values.
    const decrypted = await (app.service('payment-connections') as any).getDecryptedCredentials(medic.id);
    assert.strictEqual(decrypted.accessToken, FAKE_ACCESS_TOKEN);
    assert.strictEqual(decrypted.refreshToken, FAKE_REFRESH_TOKEN);
  });

  it('rejects a reused state without touching the provider again', async () => {
    const state = await startOauth();

    const first = makeRes();
    await callbackHandler({ query: { code: 'auth-code-2', state } }, first);
    assert.match(first.redirects[0], /connected=1$/);

    const second = makeRes();
    await callbackHandler({ query: { code: 'auth-code-3', state } }, second);
    assert.match(second.redirects[0], /connect_error=state_mismatch$/);
    assert.strictEqual(calls.exchange.length, 1, 'a reused state must not reach the provider');
  });

  it('rejects an unknown state and never falls back to any user', async () => {
    const res = makeRes();
    await callbackHandler({ query: { code: 'auth-code-4', state: 'not-a-real-state' } }, res);

    assert.match(res.redirects[0], /connect_error=state_mismatch$/);
    assert.strictEqual(calls.exchange.length, 0);
  });

  it('rejects an expired state', async () => {
    const state = await startOauth();

    const sequelize: Sequelize = app.get('sequelizeClient');
    await sequelize.query(
      'UPDATE "payment_oauth_states" SET "expiresAt" = NOW() - INTERVAL \'1 minute\' WHERE "state" = :state',
      { replacements: { state } }
    );

    const res = makeRes();
    await callbackHandler({ query: { code: 'auth-code-5', state } }, res);
    assert.match(res.redirects[0], /connect_error=state_mismatch$/);
    assert.strictEqual(calls.exchange.length, 0);
  });

  it('redirects with a denied outcome when the provider reports an error', async () => {
    const res = makeRes();
    await callbackHandler({ query: { error: 'access_denied' } }, res);
    assert.match(res.redirects[0], /connect_error=denied$/);
  });

  it('disconnects: revokes upstream best-effort and deletes the credentials', async () => {
    const state = await startOauth();
    await callbackHandler({ query: { code: 'auth-code-6', state } }, makeRes());

    const result = await app.service('payment-connections').remove('current', asProvider(medic, org.id)) as any;

    assert.strictEqual(result.connected, false);
    assert.strictEqual(calls.revoke, 1);

    const sequelize: Sequelize = app.get('sequelizeClient');
    const rows = await sequelize.query(
      'SELECT id FROM "payment_connections" WHERE "userId" = :userId',
      { replacements: { userId: medic.id }, type: QueryTypes.SELECT }
    );
    assert.strictEqual(rows.length, 0, 'credentials must be deleted');
  });

  it('attaches the display fee to get(current) once a price is configured', async () => {
    await app.service('accounting-settings').create({
      userId: medic.id,
      organizationId: org.id,
      insurerPrices: { _particular: { encounter: 5000 } },
    }, { provider: undefined });

    const current = await app.service('payment-connections').get('current', asProvider(medic, org.id)) as any;

    assert.deepStrictEqual(current.resolvedFee, {
      amount: 500000,
      feeMinor: 500000,
      currency: 'ARS',
      chargePortion: 100,
    });
    // Still no secrets anywhere near the response.
    assert.ok(!JSON.stringify(current).includes(FAKE_ACCESS_TOKEN));
  });

  it('stores an empty refresh token as null so decryption still works', async () => {
    const svc: any = app.service('payment-connections');
    // A provider (or TEST credential) with no refresh token must not poison
    // the row — makeDefine leaves empty encrypted fields UNencrypted, which
    // then breaks PGP_SYM_DECRYPT for the whole read.
    await svc.storeCredentials(String(medic.id), 'mercado_pago', {
      accessToken: 'access-only-token',
      refreshToken: '',
      providerAccountId: '999',
      expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000),
    }, { logEvent: false });

    const decrypted = await svc.getDecryptedCredentials(medic.id);
    assert.strictEqual(decrypted.accessToken, 'access-only-token');
    assert.strictEqual(decrypted.refreshToken, '');

    const current = await app.service('payment-connections').get('current', asProvider(medic, org.id)) as any;
    assert.strictEqual(current.connected, true);
    assert.strictEqual(current.credentialsUnreadable, undefined);

    await app.service('payment-connections').remove('current', asProvider(medic, org.id));
  });

  it('reports a connection whose tokens cannot be decrypted as NOT connected', async () => {
    const state = await startOauth();
    await callbackHandler({ query: { code: 'auth-code-7', state } }, makeRes());

    // Simulate a key rotation / foreign-key seed: ciphertext the current key
    // cannot open.
    const sequelize: Sequelize = app.get('sequelizeClient');
    await sequelize.query(
      'UPDATE "payment_connections" SET "accessToken" = :garbage WHERE "userId" = :userId',
      { replacements: { garbage: Buffer.from('not-pgp-data'), userId: medic.id } }
    );

    const current = await app.service('payment-connections').get('current', asProvider(medic, org.id)) as any;

    assert.strictEqual(current.connected, false);
    assert.strictEqual(current.status, 'refresh_failed');
    assert.strictEqual(current.credentialsUnreadable, true);

    // Clean up so later tests start from a disconnected state.
    await app.service('payment-connections').remove('current', asProvider(medic, org.id));
  });

  it('exposes no bulk read surface at all', () => {
    // The class implements only get/create/remove — there is no find/update/
    // patch method to leak credential rows through.
    const service = app.service('payment-connections') as unknown as Record<string, unknown>;
    assert.strictEqual(typeof service.find, 'undefined');
    assert.strictEqual(typeof service.update, 'undefined');
    assert.strictEqual(typeof service.patch, 'undefined');
  });
});
