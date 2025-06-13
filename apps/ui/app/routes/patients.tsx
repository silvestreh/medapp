import { type MetaFunction } from '@remix-run/node';

import { Title } from '~/components/typography';
import { authenticatedLoader } from '~/utils/auth.server';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Pacientes' }];
};

export const loader = authenticatedLoader();

export default function Encounters() {
  return (
    <div>
      <Title>Patients Page</Title>
      <p>Welcome to the Patients page.</p>
    </div>
  );
}
