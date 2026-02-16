import type { ReactNode } from 'react';
import { Drawer, type DrawerProps } from '@mantine/core';

import { useRouteDrawer } from '~/hooks/use-route-drawer';

interface RouteDrawerProps extends Omit<DrawerProps, 'opened' | 'onClose'> {
  children: ReactNode;
  preventScrollReset?: boolean;
}

export function RouteDrawer({ children, preventScrollReset, ...rest }: RouteDrawerProps) {
  const { opened, onClose, onExited } = useRouteDrawer({ preventScrollReset });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      keepMounted
      transitionProps={{ onExited }}
      {...rest}
    >
      {children}
    </Drawer>
  );
}
