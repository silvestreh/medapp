import { type MetaFunction } from '@remix-run/node';

import { Title } from '~/components/typography';
import { authenticatedLoader } from '~/utils/auth.server';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Estudios' }];
};
export const loader = authenticatedLoader();

export default function Encounters() {
  return (
    <div>
      <Title>Studies Page</Title>
      <p>Welcome to the Studies page.</p>
    </div>
  );
}
