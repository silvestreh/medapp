import { Drawer, Title } from '@mantine/core';
import { useLocation, useNavigate } from '@remix-run/react';
import { useMediaQuery } from '@mantine/hooks';
import { useTranslation } from 'react-i18next';
import { media } from '~/media';

const AppointmentsSettings = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isTablet = useMediaQuery(media.lg);

  const handleClose = () => {
    const parent = location.pathname.split('/').slice(0, -1).join('/');
    navigate(parent, { preventScrollReset: isTablet });
  };

  return (
    <Drawer
      opened={true}
      onClose={handleClose}
      position={isTablet ? 'right' : 'bottom'}
      styles={{ content: { minWidth: '50vw' } }}
    >
      <Title order={3}>{t('common.settings')}</Title>
    </Drawer>
  );
};

export default AppointmentsSettings;
