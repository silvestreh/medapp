import * as Sentry from '@sentry/node';

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

    if (statusCode === 401 || statusCode === '401') {
      return null;
    }

    // Filter JWT expiration errors that bypass Feathers error wrapping
    const errorName = error?.name as string | undefined;
    if (errorName === 'TokenExpiredError' || errorName === 'JsonWebTokenError') {
      return null;
    }

    return event;
  },
});

export default Sentry;
