import type { ReactNode } from 'react';
import { Drawer, type DrawerProps } from '@mantine/core';

import { useRouteDrawer } from '~/hooks/use-route-drawer';

interface RouteDrawerProps extends Omit<DrawerProps, 'opened' | 'onClose'> {
  children: ReactNode;
  skeleton?: ReactNode;
  opened?: boolean;
  onClose?: () => void;
  onExited?: () => void;
  preventScrollReset?: boolean;
}

export function RouteDrawer({
  children,
  skeleton,
  opened: controlledOpened,
  onClose: onCloseProp,
  onExited: onExitedProp,
  preventScrollReset,
  ...rest
}: RouteDrawerProps) {
  const hook = useRouteDrawer({ preventScrollReset });
  const isControlled = controlledOpened !== undefined;
  const opened = isControlled ? controlledOpened : hook.opened;
  const onClose = isControlled ? onCloseProp || (() => {}) : hook.onClose;
  const onExited = onExitedProp || hook.onExited;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      keepMounted
      transitionProps={{ onExited }}
      {...rest}
    >
      {hook.isLoading && skeleton ? skeleton : children}
    </Drawer>
  );
}
