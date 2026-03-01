import { useCallback } from 'react';
import { type MetaFunction, type LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData, Outlet, useNavigate } from '@remix-run/react';
import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import MedicList from '~/components/medic-list';
import Portal from '~/components/portal';
import RouteErrorFallback from '~/components/route-error-fallback';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'appointments') }];
};

const DEFAULT_MEDIC_ID = '540dc81947771d1f3f8b4567';

export const loader = authenticatedLoader(async ({ request, params }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const membersResponse = await client.service('organization-users').find({
    query: { $populate: true, $limit: 200 },
  });
  const allMembers = Array.isArray(membersResponse) ? membersResponse : ((membersResponse as any)?.data ?? []);

  const userRolesResponse = await client.service('user-roles').find({
    query: { roleId: 'medic', $limit: 500 },
  });
  const medicUserRoles = Array.isArray(userRolesResponse) ? userRolesResponse : ((userRolesResponse as any)?.data ?? []);
  const medicUserIds = new Set(medicUserRoles.map((ur: any) => ur.userId));

  const medics = allMembers
    .filter((m: any) => m.user && medicUserIds.has(m.userId))
    .map((m: any) => m.user);

  if (!params.medicId) {
    const defaultMedic = medics.find((m: { id: string }) => m.id === DEFAULT_MEDIC_ID) ?? medics[0];
    throw redirect(`/appointments/${defaultMedic?.id ?? DEFAULT_MEDIC_ID}`);
  }

  return { medics };
});

export default function AppointmentsLayout() {
  const { medics } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handleChange = useCallback(
    (value: string | null) => {
      if (value) {
        navigate(`/appointments/${value}`);
      }
    },
    [navigate]
  );

  return (
    <div>
      <Portal id="toolbar">
        <MedicList onChange={handleChange} medics={medics} />
      </Portal>
      <Outlet />
    </div>
  );
}

export const ErrorBoundary = RouteErrorFallback;
