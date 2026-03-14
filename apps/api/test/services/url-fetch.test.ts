import assert from 'assert';
import app from '../../src/app';

describe('\'url-fetch\' service', () => {
  it('registered the service', () => {
    const service = app.service('url-fetch');
    assert.ok(service, 'Registered the service');
  });

  it('rejects requests without a url', async () => {
    try {
      await app.service('url-fetch').create({} as any);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
      assert.ok(err.message.includes('url is required'));
    }
  });

  it('rejects invalid URLs', async () => {
    try {
      await app.service('url-fetch').create({ url: 'not-a-url' });
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
      assert.ok(err.message.includes('Invalid URL'));
    }
  });

  it('rejects non-http protocols', async () => {
    try {
      await app.service('url-fetch').create({ url: 'ftp://example.com/image.png' });
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.strictEqual(err.code, 400);
      assert.ok(err.message.includes('Only http and https'));
    }
  });

  it('rejects URLs pointing to private IPs (SSRF protection)', async () => {
    const privateUrls = [
      'http://127.0.0.1/image.png',
      'http://10.0.0.1/image.png',
      'http://172.16.0.1/image.png',
      'http://192.168.1.1/image.png',
    ];

    for (const url of privateUrls) {
      try {
        await app.service('url-fetch').create({ url });
        assert.fail(`Should have rejected ${url}`);
      } catch (err: any) {
        assert.ok(
          err.code === 400 &&
            (err.message.includes('private') || err.message.includes('resolve')),
          `Expected SSRF rejection for ${url}, got: ${err.message}`
        );
      }
    }
  });

  it('disallows find, get, update, patch, remove via MethodNotAllowed', async () => {
    const service = app.service('url-fetch');

    for (const method of ['find', 'get', 'update', 'patch', 'remove'] as const) {
      try {
        await (service as any)[method]('test');
        assert.fail(`${method} should have thrown`);
      } catch (err: any) {
        assert.strictEqual(err.code, 405, `${method} should return 405`);
      }
    }
  });
});
