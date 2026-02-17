import { type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';

import { authenticatedLoader } from '~/utils/auth.server';
import { getPageTitle } from '~/utils/meta';

export const meta: MetaFunction = ({ matches }) => {
  return [{ title: getPageTitle(matches, 'patients') }];
};

export const loader = authenticatedLoader();

export default function PatientsLayout() {
  return <Outlet />;
}
