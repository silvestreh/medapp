import { type MetaFunction } from '@remix-run/node';
import { Outlet } from '@remix-run/react';

import { authenticatedLoader } from '~/utils/auth.server';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Pacientes' }];
};

export const loader = authenticatedLoader();

export default function PatientsLayout() {
  return <Outlet />;
}
