import assert from 'assert';
import type { Request } from 'express';
import { clientIpKey } from '../../src/utils/rate-limit-key';

const PROXY_SECRET = 'test-proxy-secret';

function makeRequest(headers: Record<string, string | string[]>, ip = '10.0.0.1'): Request {
  return { headers, ip } as unknown as Request;
}

describe('clientIpKey', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.PROXY_SECRET;
    process.env.PROXY_SECRET = PROXY_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.PROXY_SECRET;
    } else {
      process.env.PROXY_SECRET = originalSecret;
    }
  });

  it('uses the forwarded client IP when the proxy token matches', () => {
    const req = makeRequest({ 'x-proxy-token': PROXY_SECRET, 'x-client-ip': '203.0.113.7' });
    assert.strictEqual(clientIpKey(req), '203.0.113.7');
  });

  it('gives two clients behind the same proxy different keys', () => {
    const a = makeRequest({ 'x-proxy-token': PROXY_SECRET, 'x-client-ip': '203.0.113.7' });
    const b = makeRequest({ 'x-proxy-token': PROXY_SECRET, 'x-client-ip': '203.0.113.8' });
    assert.notStrictEqual(clientIpKey(a), clientIpKey(b));
  });

  it('ignores the forwarded client IP without a valid proxy token', () => {
    const req = makeRequest({ 'x-client-ip': '203.0.113.7' });
    assert.strictEqual(clientIpKey(req), '10.0.0.1');
  });

  it('ignores the forwarded client IP when the proxy token is wrong', () => {
    const req = makeRequest({ 'x-proxy-token': 'wrong', 'x-client-ip': '203.0.113.7' });
    assert.strictEqual(clientIpKey(req), '10.0.0.1');
  });

  it('ignores the forwarded client IP when PROXY_SECRET is unset', () => {
    delete process.env.PROXY_SECRET;
    const req = makeRequest({ 'x-proxy-token': PROXY_SECRET, 'x-client-ip': '203.0.113.7' });
    assert.strictEqual(clientIpKey(req), '10.0.0.1');
  });

  it('falls back to req.ip when the proxy forwards no client IP', () => {
    const req = makeRequest({ 'x-proxy-token': PROXY_SECRET });
    assert.strictEqual(clientIpKey(req), '10.0.0.1');
  });

  it('groups IPv6 clients into a subnet rather than keying per address', () => {
    const a = makeRequest({ 'x-proxy-token': PROXY_SECRET, 'x-client-ip': '2001:db8:1::1' });
    const b = makeRequest({ 'x-proxy-token': PROXY_SECRET, 'x-client-ip': '2001:db8:1::2' });
    assert.strictEqual(clientIpKey(a), clientIpKey(b));
  });

  it('does not throw when req.ip is undefined', () => {
    const req = { headers: {} } as unknown as Request;
    assert.doesNotThrow(() => clientIpKey(req));
  });
});
