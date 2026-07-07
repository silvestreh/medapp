import assert from 'assert';
import { redeployRailwayService, resetRailwayCooldownForTesting } from '../../src/utils/railway';

describe('railway redeploy utility', () => {
  const originalFetch = globalThis.fetch;
  const prevToken = process.env.RAILWAY_API_TOKEN;
  const prevService = process.env.RAILWAY_EVOLUTION_SERVICE_ID;
  const prevEnv = process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID;

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  beforeEach(() => {
    resetRailwayCooldownForTesting();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv('RAILWAY_API_TOKEN', prevToken);
    restoreEnv('RAILWAY_EVOLUTION_SERVICE_ID', prevService);
    restoreEnv('RAILWAY_EVOLUTION_ENVIRONMENT_ID', prevEnv);
  });

  it('no-ops with reason="not-configured" when env vars missing', async () => {
    delete process.env.RAILWAY_API_TOKEN;
    delete process.env.RAILWAY_EVOLUTION_SERVICE_ID;
    delete process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID;

    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('', { status: 200 });
    }) as any;

    const result = await redeployRailwayService();
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'not-configured');
    assert.strictEqual(fetchCalled, false);
  });

  it('posts GraphQL mutation with correct shape on success', async () => {
    process.env.RAILWAY_API_TOKEN = 'tok-abc';
    process.env.RAILWAY_EVOLUTION_SERVICE_ID = 'svc-123';
    process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID = 'env-456';

    let calledUrl = '';
    let calledInit: RequestInit | undefined;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calledUrl = url;
      calledInit = init;
      return new Response(JSON.stringify({ data: { serviceInstanceRedeploy: true } }), { status: 200 });
    }) as any;

    const result = await redeployRailwayService();

    assert.strictEqual(result.ok, true);
    assert.match(calledUrl, /backboard\.railway\.com\/graphql\/v2\?serviceInstanceRedeploy$/);
    assert.strictEqual((calledInit?.headers as any).Authorization, 'Bearer tok-abc');
    const body = JSON.parse(calledInit?.body as string);
    assert.ok(body.query.includes('serviceInstanceRedeploy'));
    assert.deepStrictEqual(body.variables, { serviceId: 'svc-123', environmentId: 'env-456' });
  });

  it('respects 10-min cooldown on subsequent calls', async () => {
    process.env.RAILWAY_API_TOKEN = 'tok-abc';
    process.env.RAILWAY_EVOLUTION_SERVICE_ID = 'svc-123';
    process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID = 'env-456';

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return new Response(JSON.stringify({ data: { serviceInstanceRedeploy: true } }), { status: 200 });
    }) as any;

    const first = await redeployRailwayService();
    const second = await redeployRailwayService();

    assert.strictEqual(first.ok, true);
    assert.strictEqual(second.ok, false);
    assert.strictEqual(second.reason, 'cooldown');
    assert.strictEqual(fetchCount, 1, 'fetch should be called only once due to cooldown');
  });

  it('returns request-failed on non-2xx', async () => {
    process.env.RAILWAY_API_TOKEN = 'tok-abc';
    process.env.RAILWAY_EVOLUTION_SERVICE_ID = 'svc-123';
    process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID = 'env-456';

    globalThis.fetch = (async () => new Response('rate limited', { status: 429 })) as any;

    const result = await redeployRailwayService();
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'request-failed');
    assert.strictEqual(result.status, 429);
  });

  it('returns graphql-error when response contains errors', async () => {
    process.env.RAILWAY_API_TOKEN = 'tok-abc';
    process.env.RAILWAY_EVOLUTION_SERVICE_ID = 'svc-123';
    process.env.RAILWAY_EVOLUTION_ENVIRONMENT_ID = 'env-456';

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ errors: [{ message: 'unknown service' }] }), { status: 200 })
    ) as any;

    const result = await redeployRailwayService();
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'graphql-error');
  });
});
