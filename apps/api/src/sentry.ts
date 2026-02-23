import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  sendDefaultPii: true,
  beforeSend(event, hint) {
    const error = hint?.originalException as Record<string, unknown> | undefined;
    const statusCode = error?.code ?? error?.statusCode ?? error?.status;

    if (statusCode === 401) {
      return null;
    }

    return event;
  },
});

export default Sentry;
