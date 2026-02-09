import * as Sentry from '@sentry/remix';
import { replayIntegration } from '@sentry/remix';
import { RemixBrowser, useLocation, useMatches } from '@remix-run/react';
import { startTransition, StrictMode, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n, { resources } from '~/i18n/i18n';

import { ClientCacheProvider } from '~/stitches';

Sentry.init({
  dsn: 'https://d000ab2531d759f74d2cbd4257414635@o4508344607834112.ingest.de.sentry.io/4508344611569744',
  tracesSampleRate: 0.1,

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

async function main() {
  const i18nInstance = i18next;
  await i18nInstance
    .use(initReactI18next) // Tell i18next to use the react-i18next plugin
    .init({
      ...i18n, // spread the configuration
      resources,
      // This function detects the namespaces your routes rendered for i18next
      // to know what to load
      ns: i18n.defaultNS,
    });

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nextProvider i18n={i18next}>
          <ClientCacheProvider>
            <RemixBrowser />
          </ClientCacheProvider>
        </I18nextProvider>
      </StrictMode>
    );
  });
}

main();
