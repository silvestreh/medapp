import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
import { useMediaQuery } from '@mantine/hooks';

import { media } from '~/media';

interface UseRouteDrawerOptions {
  preventScrollReset?: boolean;
}

export function useRouteDrawer(options: UseRouteDrawerOptions = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isTablet = useMediaQuery(media.lg);
  const [opened, setOpened] = useState(false);
  const preventScrollReset = options.preventScrollReset ?? isTablet;

  useEffect(() => {
    setOpened(true);
  }, []);

  const onClose = useCallback(() => {
    setOpened(false);
  }, []);

  const onExited = useCallback(() => {
    const parent = location.pathname.split('/').slice(0, -1).join('/');
    navigate(parent, { preventScrollReset });
  }, [location.pathname, navigate, preventScrollReset]);

  return { opened, isTablet, onClose, onExited };
}
