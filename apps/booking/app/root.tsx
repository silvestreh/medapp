import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from '@remix-run/react';
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useChangeLanguage } from 'remix-i18next/react';
import '~/global.css';
import '@mantine/core/styles.layer.css';
import '@mantine/dates/styles.layer.css';
import '@mantine/notifications/styles.layer.css';

import { theme } from '~/theme';
import { localeCookie, resolveLocale } from '~/i18n/i18next.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const locale = await resolveLocale(request);
  return json(
    { locale },
    { headers: { 'Set-Cookie': await localeCookie.serialize(locale) } }
  );
};

function Document({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const locale = data?.locale || 'es';

  return (
    <html lang={locale} dir="ltr" suppressHydrationWarning>
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

export function ErrorBoundary() {
  return (
    <Document>
      <MantineProvider theme={theme}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>Please try again later.</p>
        </div>
      </MantineProvider>
    </Document>
  );
}

export default function App() {
  const data = useRouteLoaderData<typeof loader>('root');
  const locale = data?.locale || 'es';
  useChangeLanguage(locale);

  return (
    <Document>
      <MantineProvider theme={theme}>
        <Notifications position="top-right" />
        <Outlet />
      </MantineProvider>
    </Document>
  );
}
