import { type MetaFunction } from '@remix-run/node';
import { useTranslation } from 'react-i18next';

import { Title } from '~/components/typography';
import { authenticatedLoader } from '~/utils/auth.server';

export const meta: MetaFunction = () => {
  return [{ title: 'MedApp / Usuarios & Roles' }];
};

export const loader = authenticatedLoader();

export default function Encounters() {
  const { t } = useTranslation();

  return (
    <div>
      <Title>{t('users.page_title')}</Title>
      <p>{t('users.page_description')}</p>
    </div>
  );
}
