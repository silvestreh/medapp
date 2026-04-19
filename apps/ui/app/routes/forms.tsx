import '@mantine/dates/styles.css';
import { redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { getAuthenticatedClient, getCurrentOrgRoleIds } from '~/utils/auth.server';
import { getCurrentOrganizationId } from '~/session';
import RouteErrorFallback from '~/components/route-error-fallback';

export const meta: MetaFunction = () => {
  return [{ title: 'Forms | Athelas' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);
  const organizationId = await getCurrentOrganizationId(request);
  const roleIds = getCurrentOrgRoleIds(user, organizationId);

  const canAccessForms = roleIds.includes('form-designer');

  if (!canAccessForms) {
    throw redirect('/');
  }

  return null;
};

export default function FormsLayout() {
  return <Outlet />;
}

export function ErrorBoundary() {
  return <RouteErrorFallback />;
}
