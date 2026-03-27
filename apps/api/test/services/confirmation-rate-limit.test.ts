import assert from 'assert';
import { TooManyRequests } from '@feathersjs/errors';
import rateLimitConfirmation, {
  emailRateLimits,
  MAX_REQUESTS,
  WINDOW_MS,
} from '../../src/services/confirmations/hooks/rate-limit-confirmation';

describe('rateLimitConfirmation hook', () => {
  beforeEach(() => {
    emailRateLimits.clear();
  });

  it('allows requests under the limit', async () => {
    const hook = rateLimitConfirmation();
    const context: any = {
      data: { email: 'test@example.com', type: 'password-reset' },
    };

    for (let i = 0; i < MAX_REQUESTS; i++) {
      const result = await hook(context);
      assert.strictEqual(result, context);
    }
  });

  it('throws TooManyRequests after exceeding the limit', async () => {
    const hook = rateLimitConfirmation();
    const context: any = {
      data: { email: 'flood@example.com', type: 'password-reset' },
    };

    for (let i = 0; i < MAX_REQUESTS; i++) {
      await hook(context);
    }

    await assert.rejects(
      async () => hook(context),
      (error: any) => {
        assert.ok(error instanceof TooManyRequests);
        assert.strictEqual(error.code, 429);
        return true;
      }
    );
  });

  it('resets after the window expires', async () => {
    const hook = rateLimitConfirmation();
    const email = 'reset-window@example.com';
    const context: any = {
      data: { email, type: 'password-reset' },
    };

    for (let i = 0; i < MAX_REQUESTS; i++) {
      await hook(context);
    }

    // Simulate window expiry by backdating the entry
    const entry = emailRateLimits.get(email);
    assert.ok(entry, 'Rate limit entry should exist');
    entry.windowStart = Date.now() - WINDOW_MS - 1;

    const result = await hook(context);
    assert.strictEqual(result, context);
  });

  it('treats emails case-insensitively', async () => {
    const hook = rateLimitConfirmation();

    for (let i = 0; i < MAX_REQUESTS; i++) {
      await hook({ data: { email: 'CaSe@Example.COM' } } as any);
    }

    await assert.rejects(
      async () => hook({ data: { email: 'case@example.com' } } as any),
      (error: any) => {
        assert.strictEqual(error.code, 429);
        return true;
      }
    );
  });

  it('skips rate limiting when email is missing', async () => {
    const hook = rateLimitConfirmation();
    const context: any = { data: {} };
    const result = await hook(context);
    assert.strictEqual(result, context);
  });

  it('tracks different emails independently', async () => {
    const hook = rateLimitConfirmation();

    for (let i = 0; i < MAX_REQUESTS; i++) {
      await hook({ data: { email: 'user-a@example.com' } } as any);
    }

    // user-b should still be allowed
    const context: any = { data: { email: 'user-b@example.com' } };
    const result = await hook(context);
    assert.strictEqual(result, context);
  });
});
