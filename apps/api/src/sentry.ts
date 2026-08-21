import * as Sentry from '@sentry/node';
import { sanitizeForLog } from './utils/sanitize-for-log';

// Payment/OAuth material must never reach Sentry, even inside error messages.
export function scrubEventSecrets(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const scrubString = (value: string): string =>
    value.replace(/Bearer\s+[A-Za-z0-9\-_.~+/=]+/g, 'Bearer [REDACTED]');

  if (event.request) {
    event.request = sanitizeForLog(event.request) as typeof event.request;
  }
  if (event.extra) {
    event.extra = sanitizeForLog(event.extra) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = sanitizeForLog(event.contexts) as typeof event.contexts;
  }

  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === 'string') {
      exception.value = scrubString(exception.value);
    }
  }
  if (typeof event.message === 'string') {
    event.message = scrubString(event.message);
  }

  return event;
}

function stripUrlApiKey(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('api-key')) {
      u.searchParams.set('api-key', '[FILTERED]');
      return u.toString();
    }
  } catch {
    // not a valid URL, return as-is
  }
  return url;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  sendDefaultPii: true,
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'http' && breadcrumb.data) {
      if (breadcrumb.data.url) {
        breadcrumb.data.url = stripUrlApiKey(breadcrumb.data.url);
      }
      if (typeof breadcrumb.data['http.query'] === 'string' && breadcrumb.data['http.query'].includes('api-key')) {
        breadcrumb.data['http.query'] = breadcrumb.data['http.query'].replace(/api-key=[^&]+/, 'api-key=[FILTERED]');
      }
    }
    return breadcrumb;
  },
  beforeSend(event, hint) {
    const error = hint?.originalException as Record<string, unknown> | undefined;
    const statusCode = error?.code ?? error?.statusCode ?? error?.status;

    // 4xx means the caller sent something we rejected on purpose — bad slugs
    // from subdomain scanners, expired sessions, malformed payloads. Not defects.
    // The `captureSentryError` hook already skips these, but
    // `Sentry.setupExpressErrorHandler` re-captures them at the Express layer
    // (mechanism: auto.middleware.express), so the filter has to live here too.
    const status = typeof statusCode === 'string' ? Number(statusCode) : statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return null;
    }

    // Filter JWT expiration errors that bypass Feathers error wrapping
    const errorName = error?.name as string | undefined;
    if (errorName === 'TokenExpiredError' || errorName === 'JsonWebTokenError') {
      return null;
    }

    return scrubEventSecrets(event);
  },
});

export default Sentry;
