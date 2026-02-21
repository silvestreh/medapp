import * as Sentry from '@sentry/remix';
import process from 'node:process';

Sentry.init({
  dsn: process.env.VITE_SENTRY_DSN,
  tracesSampleRate: 1,
  autoInstrumentRemix: true,
  environment: process.env.NODE_ENV || 'development',
});
