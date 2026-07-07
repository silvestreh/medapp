import assert from 'assert';
import { WhatsApp, type WhatsAppCreateData } from '../../src/services/whatsapp/whatsapp.class';
import { setEnqueueImplForTesting, resetWhatsappQueueForTesting } from '../../src/queues/whatsapp-queue';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function makeApp(overrides: { connected?: boolean; hasInstance?: boolean } = {}): any {
  const { connected = true, hasInstance = true } = overrides;
  return {
    get: (key: string) => {
      if (key === 'evolution') return { apiUrl: 'https://evo.test', apiKey: 'test-key' };
      return undefined;
    },
    service: () => ({
      get: async () => ({
        id: 'org1',
        settings: hasInstance
          ? {
            whatsapp: {
              instanceName: 'test-instance',
              instanceId: 'inst-1',
              connected,
            },
          }
          : {},
      }),
      patch: async () => ({}),
    }),
  };
}

describe('WhatsApp service', () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls: FetchCall[] = [];
  let enqueueCalls: WhatsAppCreateData[] = [];

  function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      return handler(url, init);
    }) as any;
  }

  beforeEach(() => {
    fetchCalls = [];
    enqueueCalls = [];
    setEnqueueImplForTesting(async (payload) => {
      enqueueCalls.push(payload);
      return true;
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetWhatsappQueueForTesting();
  });

  it('sends text successfully when instance is open', async () => {
    mockFetch((url) => {
      if (url.includes('/instance/connectionState/')) {
        return new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 });
      }
      if (url.includes('/message/sendText/')) {
        return new Response(JSON.stringify({ key: { id: 'msg-1' } }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const wa = new WhatsApp(makeApp({ connected: true }));
    const result = await wa.create({
      type: 'text',
      organizationId: 'org1',
      to: '2214567890',
      body: 'hello',
    });

    assert.strictEqual(result.sent, true);
    assert.strictEqual(result.messageId, 'msg-1');
    assert.strictEqual(enqueueCalls.length, 0);
  });

  it('enqueues when instance is not connected (pre-flight short-circuit)', async () => {
    mockFetch((url) => {
      if (url.includes('/instance/connectionState/')) {
        return new Response(JSON.stringify({ instance: { state: 'close' } }), { status: 200 });
      }
      throw new Error(`Should not call send: ${url}`);
    });

    const wa = new WhatsApp(makeApp({ connected: true }));
    const payload: WhatsAppCreateData = {
      type: 'text',
      organizationId: 'org1',
      to: '2214567890',
      body: 'queued message',
    };
    const result = await wa.create(payload);

    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, true);
    assert.strictEqual(result.reason, 'instance-not-connected');
    assert.strictEqual(enqueueCalls.length, 1);
    assert.deepStrictEqual(enqueueCalls[0], payload);
  });

  it('returns no-instance reason when org has no WhatsApp settings', async () => {
    mockFetch(() => new Response('should not call', { status: 200 }));

    const wa = new WhatsApp(makeApp({ hasInstance: false }));
    const result = await wa.create({
      type: 'text',
      organizationId: 'org1',
      to: '2214567890',
      body: 'x',
    });

    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.reason, 'no-instance');
    assert.strictEqual(enqueueCalls.length, 0);
  });

  it('retries on 500 "Connection Closed" and then enqueues', async () => {
    let sendAttempts = 0;
    mockFetch((url) => {
      if (url.includes('/instance/connectionState/')) {
        return new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 });
      }
      if (url.includes('/message/sendText/')) {
        sendAttempts++;
        return new Response(JSON.stringify({ message: ['Error: Connection Closed'] }), { status: 500 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const wa = new WhatsApp(makeApp({ connected: true }));
    const result = await wa.create({
      type: 'text',
      organizationId: 'org1',
      to: '2214567890',
      body: 'retried',
    });

    assert.strictEqual(sendAttempts, 3, 'pRetry should make 3 attempts (1 + 2 retries)');
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, true);
    assert.strictEqual(result.reason, 'send-failed-evolution');
    assert.strictEqual(enqueueCalls.length, 1);
  });

  it('does not retry on 4xx and does not enqueue', async () => {
    let sendAttempts = 0;
    mockFetch((url) => {
      if (url.includes('/instance/connectionState/')) {
        return new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 });
      }
      if (url.includes('/message/sendText/')) {
        sendAttempts++;
        return new Response(JSON.stringify({ message: 'Bad Request' }), { status: 400 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const wa = new WhatsApp(makeApp({ connected: true }));
    const result = await wa.create({
      type: 'text',
      organizationId: 'org1',
      to: '2214567890',
      body: 'no-retry',
    });

    assert.strictEqual(sendAttempts, 1, '4xx should not be retried');
    assert.strictEqual(result.sent, false);
    assert.strictEqual(result.queued, undefined);
    assert.strictEqual(result.reason, 'evolution-400');
    assert.strictEqual(enqueueCalls.length, 0);
  });

  it('_sendNow throws on retryable error without enqueueing (worker-safe)', async () => {
    let sendAttempts = 0;
    mockFetch((url) => {
      if (url.includes('/message/sendText/')) {
        sendAttempts++;
        return new Response('Connection Closed', { status: 500 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const wa = new WhatsApp(makeApp({ connected: true }));
    let thrown: any;
    try {
      await wa._sendNow({
        type: 'text',
        organizationId: 'org1',
        to: '2214567890',
        body: 'worker-call',
      });
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, '_sendNow should throw on retryable failure');
    assert.strictEqual(thrown.__whatsappRetryable, true);
    assert.strictEqual(sendAttempts, 3);
    assert.strictEqual(enqueueCalls.length, 0, '_sendNow should never enqueue');
  });

  it('returns evolution-not-configured when API URL is missing', async () => {
    const prevUrl = process.env.EVOLUTION_API_URL;
    const prevKey = process.env.EVOLUTION_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    try {
      const app = {
        get: () => ({}),
        service: () => ({ get: async () => ({}) }),
      };
      const wa = new WhatsApp(app as any);
      const result = await wa.create({
        type: 'text',
        organizationId: 'org1',
        to: '2214567890',
        body: 'x',
      });
      assert.strictEqual(result.sent, false);
      assert.strictEqual(result.reason, 'evolution-not-configured');
      assert.strictEqual(enqueueCalls.length, 0);
    } finally {
      if (prevUrl !== undefined) process.env.EVOLUTION_API_URL = prevUrl;
      if (prevKey !== undefined) process.env.EVOLUTION_API_KEY = prevKey;
    }
  });
});
