import { useCallback } from 'react';
import { type MetaFunction, type LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData, Outlet, useNavigate } from '@remix-run/react';
import { useTranslation } from 'react-i18next';

import { getAuthenticatedClient, authenticatedLoader } from '~/utils/auth.server';
import MedicList from '~/components/medic-list';
import Portal from '~/components/portal';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'appointments') }];
};

const DEFAULT_MEDIC_ID = '540dc81947771d1f3f8b4567';

export const loader = authenticatedLoader(async ({ request, params }: LoaderFunctionArgs) => {
  const { client } = await getAuthenticatedClient(request);
  const query = { roleId: 'medic', $skip: 0, $limit: 100 };
  const { data: medics } = await client.service('users').find({ query });

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

export const ErrorBoundary = () => {
  const { t } = useTranslation();
  return <div>{t('common.something_went_wrong')}</div>;
};
