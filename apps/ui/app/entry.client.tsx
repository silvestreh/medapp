import * as Sentry from '@sentry/remix';
import { replayIntegration } from '@sentry/remix';
import { RemixBrowser, useLocation, useMatches } from '@remix-run/react';
import { startTransition, StrictMode, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { ClientCacheProvider } from '~/stitches';

Sentry.init({
  dsn: 'https://d000ab2531d759f74d2cbd4257414635@o4508344607834112.ingest.de.sentry.io/4508344611569744',
  tracesSampleRate: 1,

  integrations: [
    Sentry.browserTracingIntegration({
      useEffect,
      useLocation,
      useMatches,
    }),
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <ClientCacheProvider>
        <RemixBrowser />
      </ClientCacheProvider>
    </StrictMode>
  );
});
