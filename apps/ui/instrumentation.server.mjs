import * as Sentry from '@sentry/remix';
import process from 'node:process';

Sentry.init({
  dsn: 'https://d000ab2531d759f74d2cbd4257414635@o4508344607834112.ingest.de.sentry.io/4508344611569744',
  tracesSampleRate: 1,
  autoInstrumentRemix: true,
  environment: process.env.NODE_ENV || 'development',
});
