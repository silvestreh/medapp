import { Hook, HookContext } from '@feathersjs/feathers';
import { TooManyRequests } from '@feathersjs/errors';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 3;

const emailRateLimits: Map<string, RateLimitEntry> = new Map();

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of emailRateLimits) {
    if (entry.windowStart + WINDOW_MS < now) {
      emailRateLimits.delete(key);
    }
  }
}

const rateLimitConfirmation = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const email = context.data?.email?.trim()?.toLowerCase();
  if (!email) return context;

  cleanupExpired();

  const now = Date.now();
  const entry = emailRateLimits.get(email);

  if (entry && entry.windowStart + WINDOW_MS >= now) {
    if (entry.count >= MAX_REQUESTS) {
      throw new TooManyRequests('Too many password reset requests for this email');
    }
    entry.count += 1;
  } else {
    emailRateLimits.set(email, { count: 1, windowStart: now });
  }

  return context;
};

export { emailRateLimits, WINDOW_MS, MAX_REQUESTS };
export default rateLimitConfirmation;
