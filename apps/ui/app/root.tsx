import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  useLocation,
  useMatches,
} from '@remix-run/react';
import { json, type LoaderFunctionArgs, type LinksFunction } from '@remix-run/node';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { useChangeLanguage } from 'remix-i18next/react';
import { useEffect, useRef } from 'react';
import '~/global.css';
import '@mantine/core/styles.layer.css';
import '@mantine/notifications/styles.layer.css';
import '~/panda.css';

import { localeCookie, resolveLocale } from '~/i18n/i18next.server';
import { FeathersProvider } from '~/components/provider';
import MainLayout from '~/components/main-layout';
import RouteErrorFallback from '~/components/route-error-fallback';
import { getToken, getUser } from '~/utils/auth.server';
import { getCurrentOrganizationId, setCurrentOrganizationId } from '~/session';
import { theme } from '~/theme';
import { trackNavigation } from '~/utils/breadcrumbs';

const ROUTE_LABELS: Record<string, string> = {
  'routes/encounters._index': 'Encounters list',
  'routes/encounters.$patientId._index': 'Patient encounters',
  'routes/encounters.$patientId.new': 'New encounter',
  'routes/patients._index': 'Patients list',
  'routes/patients.$patientId': 'Patient detail',
  'routes/patients.new': 'New patient',
  'routes/studies._index': 'Studies list',
  'routes/studies.new': 'New study',
  'routes/studies.$studyId': 'Study detail',
  'routes/appointments': 'Appointments',
  'routes/prescriptions': 'Prescriptions',
  'routes/users': 'Users & roles',
  'routes/accounting': 'Accounting',
  'routes/stats': 'Statistics',
  'routes/settings': 'Settings',
};

export const links: LinksFunction = () => [];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const initialToken = await getToken(request);
  const initialUser = await getUser(request);
  const locale = await resolveLocale(request);

  let currentOrganizationId = await getCurrentOrganizationId(request);

  if (!currentOrganizationId && initialUser?.organizations?.length) {
    currentOrganizationId = initialUser.organizations[0].id;
    const cookieHeader = await setCurrentOrganizationId(request, currentOrganizationId as string);
    return json(
      { initialToken, initialUser, locale, currentOrganizationId },
      {
        headers: {
          'Set-Cookie': cookieHeader,
        },
      }
    );
  }

  return json(
    { initialToken, initialUser, locale, currentOrganizationId },
    {
      headers: {
        'Set-Cookie': await localeCookie.serialize(locale),
      },
    }
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

function AppLayout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const { initialToken, initialUser, currentOrganizationId } = data || {};

  return (
    <FeathersProvider
      initialToken={initialToken}
      initialUser={initialUser}
      initialOrganizationId={currentOrganizationId}
    >
      <MantineProvider theme={theme}>
        <ModalsProvider>
          <Notifications position="top-right" mt="5em" />
          <MainLayout>{children}</MainLayout>
        </ModalsProvider>
      </MantineProvider>
    </FeathersProvider>
  );
}

export const ErrorBoundary = () => {
  const data = useRouteLoaderData<typeof loader>('root');

  if (data) {
    return (
      <Document>
        <AppLayout>
          <RouteErrorFallback />
        </AppLayout>
      </Document>
    );
  }

  return (
    <Document>
      <MantineProvider theme={theme}>
        <RouteErrorFallback />
      </MantineProvider>
    </Document>
  );
};

export default function App() {
  const data = useRouteLoaderData<typeof loader>('root');
  const locale = data?.locale || 'es';
  const location = useLocation();
  const matches = useMatches();
  const prevPathRef = useRef(location.pathname);

  useChangeLanguage(locale);

  useEffect(() => {
    if (location.pathname === prevPathRef.current) return;
    prevPathRef.current = location.pathname;

    const deepestRouteId = matches.at(-1)?.id ?? '';
    const label = ROUTE_LABELS[deepestRouteId] ?? deepestRouteId;
    trackNavigation(label, { pathname: location.pathname, routeId: deepestRouteId });
  }, [location.pathname, matches]);

  return (
    <Document>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </Document>
  );
}
