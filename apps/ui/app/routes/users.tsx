import { Outlet } from '@remix-run/react';
import { type MetaFunction } from '@remix-run/node';

import { authenticatedLoader } from '~/utils/auth.server';
import { getPageTitle } from '~/utils/meta';
import RouteErrorFallback from '~/components/route-error-fallback';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'users_roles') }];
};

export const loader = authenticatedLoader();

export default function UsersLayout() {
  return <Outlet />;
}

export const ErrorBoundary = RouteErrorFallback;
