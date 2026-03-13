import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '~/global.css';
import '@mantine/core/styles.layer.css';
import '@mantine/notifications/styles.layer.css';

import { theme } from '~/theme';

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" dir="ltr" suppressHydrationWarning>
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
  return (
    <Document>
      <MantineProvider theme={theme}>
        <Notifications position="top-right" />
        <Outlet />
      </MantineProvider>
    </Document>
  );
}
