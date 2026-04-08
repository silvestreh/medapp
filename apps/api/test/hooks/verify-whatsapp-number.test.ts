import assert from 'assert';
import verifyWhatsAppNumber from '../../src/services/whatsapp/hooks/verify-whatsapp-number';

describe('verify-whatsapp-number hook', () => {
  const hook = verifyWhatsAppNumber();

  let originalFetch: typeof globalThis.fetch;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeContext(overrides: Record<string, any> = {}): any {
    return {
      data: { to: '542214567890', organizationId: 'org1' },
      app: {
        get: () => ({
          apiUrl: 'https://evo.test',
          apiKey: 'test-key',
        }),
        service: () => ({
          get: async () => ({
            settings: {
              whatsapp: {
                instanceName: 'test-instance',
                connected: true,
              },
            },
          }),
        }),
      },
      ...overrides,
    };
  }

  it('allows send when number exists on WhatsApp', async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => [{ exists: true, jid: '542214567890@s.whatsapp.net', number: '542214567890' }],
    })) as any;

    const context = makeContext();
    await hook(context);

    assert.equal(context.result, undefined);
  });

  it('short-circuits when number does not exist on WhatsApp', async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => [{ exists: false, number: '542214567890' }],
    })) as any;

    const context = makeContext();
    await hook(context);

    assert.deepStrictEqual(context.result, { sent: false, reason: 'no-whatsapp-account' });
  });

  it('proceeds when Evolution API returns non-ok response (fail-open)', async () => {
    globalThis.fetch = (async () => ({
      ok: false,
    })) as any;

    const context = makeContext();
    await hook(context);

    assert.equal(context.result, undefined);
  });

  it('proceeds when fetch throws (fail-open)', async () => {
    globalThis.fetch = (async () => {
      throw new Error('Network error');
    }) as any;

    const context = makeContext();
    await hook(context);

    assert.equal(context.result, undefined);
  });

  it('skips when Evolution API is not configured', async () => {
    const context = makeContext({
      app: {
        get: () => ({}),
        service: () => ({
          get: async () => ({
            settings: { whatsapp: { instanceName: 'test', connected: true } },
          }),
        }),
      },
    });

    await hook(context);

    assert.equal(context.result, undefined);
  });

  it('skips when org has no WhatsApp instance connected', async () => {
    globalThis.fetch = (async () => {
      throw new Error('Should not be called');
    }) as any;

    const context = makeContext({
      app: {
        get: () => ({ apiUrl: 'https://evo.test', apiKey: 'key' }),
        service: () => ({
          get: async () => ({
            settings: { whatsapp: { connected: false } },
          }),
        }),
      },
    });

    await hook(context);

    assert.equal(context.result, undefined);
  });

  it('passes through when data.to is missing', async () => {
    const context = makeContext({ data: { organizationId: 'org1' } });

    const result = await hook(context);

    assert.strictEqual(result, context);
    assert.equal(context.result, undefined);
  });

  it('passes through when data.organizationId is missing', async () => {
    const context = makeContext({ data: { to: '542214567890' } });

    const result = await hook(context);

    assert.strictEqual(result, context);
    assert.equal(context.result, undefined);
  });
});
