import * as Sentry from '@sentry/remix';
import { replayIntegration } from '@sentry/remix';
import { RemixBrowser, useLocation, useMatches } from '@remix-run/react';
import { startTransition, StrictMode, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n, { resources } from '~/i18n/i18n';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
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

  beforeSend(event) {
    const message = event.exception?.values?.[0]?.value ?? '';
    if (message.includes('manifest version mismatch')) {
      return null;
    }
    return event;
  },
});

// Safety net: if a single-fetch .data request returns non-turbo-stream data
// (e.g. HTML from a reverse proxy error page or an auth redirect the browser
// followed transparently), recover by forcing a full document navigation.
window.addEventListener('unhandledrejection', event => {
  const msg = event.reason?.message;
  if (typeof msg === 'string' && msg.includes('Unable to decode turbo-stream')) {
    event.preventDefault();
    window.location.reload();
  }
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
          <RemixBrowser />
        </I18nextProvider>
      </StrictMode>
    );
  });
}

main();
