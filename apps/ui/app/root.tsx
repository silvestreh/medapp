import { captureRemixErrorBoundaryError } from '@sentry/remix';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, useRouteLoaderData } from '@remix-run/react';
import { type LoaderFunctionArgs, type LinksFunction } from '@remix-run/node';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useChangeLanguage } from 'remix-i18next/react';
import './global.css';
import '@mantine/core/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
import './panda.css';

import i18next from '~/i18n/i18next.server';
import { FeathersProvider } from '~/components/provider';
import MainLayout from '~/components/main-layout';
import { getToken, getUser } from '~/utils/auth.server';
import { breakpoints } from '~/media';

// Override Mantine's default breakpoints to match the ones defined in ~/media.
// This keeps a single source of truth (media.ts) for PandaCSS, Mantine, and
// useMediaQuery calls. Mantine expects em values, so we convert from px (÷ 16).
const theme = createTheme({
  breakpoints: Object.fromEntries(Object.entries(breakpoints).map(([k, v]) => [k, `${v / 16}em`])) as Record<
    string,
    string
  >,
});

export const links: LinksFunction = () => [];

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
      <MantineProvider theme={theme}>
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
