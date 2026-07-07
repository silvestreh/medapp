import assert from 'assert';
import {
  enqueueWhatsapp,
  setEnqueueImplForTesting,
  resetWhatsappQueueForTesting,
  getWhatsappQueue,
} from '../../src/queues/whatsapp-queue';

describe('whatsapp queue boundary', () => {
  const prevRedis = process.env.REDIS_URL;

  beforeEach(() => {
    resetWhatsappQueueForTesting();
  });

  afterEach(() => {
    resetWhatsappQueueForTesting();
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
  });

  it('returns null queue when REDIS_URL is not set', () => {
    delete process.env.REDIS_URL;
    const q = getWhatsappQueue();
    assert.strictEqual(q, null);
  });

  it('enqueueWhatsapp returns false when REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    const result = await enqueueWhatsapp({
      type: 'text',
      organizationId: 'org1',
      to: '2214567890',
      body: 'x',
    });
    assert.strictEqual(result, false);
  });

  it('setEnqueueImplForTesting swaps the enqueue implementation', async () => {
    const received: any[] = [];
    setEnqueueImplForTesting(async (payload) => {
      received.push(payload);
      return true;
    });

    const payload = {
      type: 'text' as const,
      organizationId: 'org1',
      to: '2214567890',
      body: 'hello',
    };
    const result = await enqueueWhatsapp(payload);

    assert.strictEqual(result, true);
    assert.strictEqual(received.length, 1);
    assert.deepStrictEqual(received[0], payload);
  });

  it('resetWhatsappQueueForTesting restores the default enqueue impl', async () => {
    setEnqueueImplForTesting(async () => true);
    resetWhatsappQueueForTesting();

    delete process.env.REDIS_URL;
    const result = await enqueueWhatsapp({
      type: 'text',
      organizationId: 'org1',
      to: '2214567890',
      body: 'x',
    });
    assert.strictEqual(result, false, 'default impl returns false without Redis');
  });
});
