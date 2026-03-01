import { Outlet } from '@remix-run/react';

import RouteErrorFallback from '~/components/route-error-fallback';

export default function Auth() {
  return <Outlet />;
}

export const ErrorBoundary = RouteErrorFallback;
