import { captureRemixErrorBoundaryError } from '@sentry/remix';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, useRouteLoaderData } from '@remix-run/react';
import { json, type LoaderFunctionArgs, type LinksFunction } from '@remix-run/node';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useChangeLanguage } from 'remix-i18next/react';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import './global.css';
import '@mantine/core/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
import './panda.css';

import i18next, { localeCookie } from '~/i18n/i18next.server';
import i18n from '~/i18n/i18n';
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
  const url = new URL(request.url);
  const requestedLocale = url.searchParams.get('lng');
  const shouldSetLocaleCookie = !!requestedLocale && i18n.supportedLngs.includes(requestedLocale as any);

  return json(
    { initialToken, initialUser, apiUrl, locale },
    shouldSetLocaleCookie ? { headers: { 'Set-Cookie': await localeCookie.serialize(requestedLocale) } } : undefined
  );
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
  const { t } = useTranslation();
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);

  return (
    <Document>
      <div>{t('common.something_went_wrong')}</div>
    </Document>
  );
};

export default function App() {
  const data = useRouteLoaderData<typeof loader>('root');
  const locale = data?.locale || 'es';
  const { i18n: i18nClient } = useTranslation();

  useChangeLanguage(locale);

  useEffect(() => {
    const currentLocale = i18nClient.resolvedLanguage || locale;
    if (!currentLocale) return;

    document.cookie = `lng=${encodeURIComponent(currentLocale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [i18nClient.resolvedLanguage, locale]);

  return (
    <Document>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </Document>
  );
}
