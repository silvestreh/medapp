import { useCallback } from 'react';
import { type LinksFunction, type MetaFunction, type LoaderFunctionArgs, redirect } from '@remix-run/node';
import { Outlet, useLoaderData, useNavigate, useParams } from '@remix-run/react';
import MedicList from '~/components/medic-list';
import Portal from '~/components/portal';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';

import { getPageTitle } from '~/utils/meta';
import RouteErrorFallback from '~/components/route-error-fallback';
import { authenticatedLoader, getAuthenticatedClient } from '~/utils/auth.server';

export const links: LinksFunction = () => [];

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'accounting') }];
};

const DEFAULT_MEDIC_ID = '540dc81947771d1f3f8b4567';

export const loader = authenticatedLoader(async ({ request, params }: LoaderFunctionArgs) => {
  const { client, user } = await getAuthenticatedClient(request);

  // Fetch medics
  const membersResponse = await client.service('organization-users').find({
    query: { $populate: true, $limit: 200 },
  });
  const allMembers = Array.isArray(membersResponse) ? membersResponse : ((membersResponse as any)?.data ?? []);

  const userRolesResponse = await client.service('user-roles').find({
    query: { roleId: 'medic', $limit: 500 },
  });
  const medicUserRoles = Array.isArray(userRolesResponse)
    ? userRolesResponse
    : ((userRolesResponse as any)?.data ?? []);
  const medicUserIds = new Set(medicUserRoles.map((ur: any) => ur.userId));

  const medics = allMembers.filter((m: any) => m.user && medicUserIds.has(m.userId)).map((m: any) => m.user);

  // If no medicId param, redirect to default
  if (!params.medicId) {
    let defaultMedicId = DEFAULT_MEDIC_ID;

    // Try to use current user if they are a medic
    if (medicUserIds.has(user.id)) {
      defaultMedicId = user.id;
    } else if (medics.length > 0) {
      defaultMedicId = medics[0].id;
    }

    throw redirect(`/accounting/${defaultMedicId}`);
  }

  return { medics };
});

export default function Accounting() {
  const { medics } = useLoaderData<typeof loader>();
  const params = useParams();
  const medicId = params.medicId ?? null;
  const navigate = useNavigate();

  const handleMedicChange = useCallback(
    (value: string | null) => {
      if (value) {
        navigate(`/accounting/${value}`);
      }
    },
    [navigate]
  );

  return (
    <>
      <Portal id="toolbar">
        <div data-tour="accounting-medic">
          <MedicList onChange={handleMedicChange} medics={medics} value={medicId} />
        </div>
      </Portal>
      <Outlet />
    </>
  );
}

export const ErrorBoundary = RouteErrorFallback;
