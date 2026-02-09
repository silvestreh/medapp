import { captureRemixErrorBoundaryError } from '@sentry/remix';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  useRouteLoaderData,
} from '@remix-run/react';
import { type LoaderFunctionArgs, type LinksFunction } from '@remix-run/node';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import coreStyles from '@mantine/core/styles.css?url';
import notificationsStyles from '@mantine/notifications/styles.css?url';
import { useTranslation } from 'react-i18next';
import { useChangeLanguage } from 'remix-i18next/react';
import i18next from '~/i18n/i18next.server';

import { FeathersProvider } from '~/components/provider';
import MainLayout from '~/components/main-layout';
import { getToken, getUser } from '~/utils/auth.server';

/**
 * These stylesheets have been removed by Gemini:
 * import datesStyles from '@mantine/dates/styles.css?url';
 * import chartsStyles from '@mantine/charts/styles.css?url';
 * import nprogressStyles from '@mantine/nprogress/styles.css?url';
 * import spotlightStyles from '@mantine/spotlight/styles.css?url';
 * import tiptapStyles from '@mantine/tiptap/styles.css?url';
 */
export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: coreStyles },
  { rel: 'stylesheet', href: notificationsStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const initialToken = await getToken(request);
  const initialUser = await getUser(request);
  const apiUrl = process.env.API_URL;
  const locale = await i18next.getLocale(request);

  return { initialToken, initialUser, apiUrl, locale };
};

function Document({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const locale = data?.locale || 'es';

  return (
    <html lang={locale} dir="ltr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <ColorSchemeScript />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const { initialToken, initialUser, apiUrl } = data || {};

  return (
    <FeathersProvider initialToken={initialToken} initialUser={initialUser} apiUrl={apiUrl}>
      <MantineProvider>
        <Notifications position="top-right" mt="5em" />
        <MainLayout>{children}</MainLayout>
      </MantineProvider>
    </FeathersProvider>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);

  return (
    <Document>
      <div>Something went wrong</div>
    </Document>
  );
};

export default function App() {
  const data = useRouteLoaderData<typeof loader>('root');
  const locale = data?.locale || 'es';
  useChangeLanguage(locale);

  return (
    <Document>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </Document>
  );
}
