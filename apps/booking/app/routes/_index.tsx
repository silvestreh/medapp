import { useTranslation } from 'react-i18next';

export default function Index() {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>{t('booking.title')}</h1>
      <p>{t('common.navigate_to_org')}</p>
    </div>
  );
}
