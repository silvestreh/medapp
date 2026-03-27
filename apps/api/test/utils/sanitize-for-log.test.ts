import assert from 'assert';
import { sanitizeForLog } from '../../src/utils/sanitize-for-log';

describe('sanitizeForLog', () => {
  it('redacts sensitive keys', () => {
    const input = { username: 'admin', password: 'secret123', email: 'a@b.com' };
    const result = sanitizeForLog(input) as Record<string, unknown>;
    assert.strictEqual(result.password, '[REDACTED]');
    assert.strictEqual(result.username, 'admin');
    assert.strictEqual(result.email, 'a@b.com');
  });

  it('redacts nested sensitive keys', () => {
    const input = { authentication: { accessToken: 'jwt...', strategy: 'local' } };
    const result = sanitizeForLog(input) as Record<string, unknown>;
    const auth = result.authentication as Record<string, unknown>;
    assert.strictEqual(auth.accessToken, '[REDACTED]');
    assert.strictEqual(auth.strategy, 'local');
  });

  it('handles arrays', () => {
    const input = [{ token: 'abc' }, { name: 'test' }];
    const result = sanitizeForLog(input) as Record<string, unknown>[];
    assert.strictEqual(result[0].token, '[REDACTED]');
    assert.strictEqual(result[1].name, 'test');
  });

  it('handles null and undefined', () => {
    assert.strictEqual(sanitizeForLog(null), null);
    assert.strictEqual(sanitizeForLog(undefined), undefined);
  });

  it('does not mutate the original object', () => {
    const input = { password: 'secret' };
    sanitizeForLog(input);
    assert.strictEqual(input.password, 'secret');
  });
});
