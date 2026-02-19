import React from 'react';
import { ActionIcon } from '@mantine/core';
import { LogOut } from 'lucide-react';

import { useAccount } from '~/components/provider';

const LogoutButton: React.FC = () => {
  const { logout } = useAccount();

  return (
    <ActionIcon onClick={logout} size="2.5em" variant="subtle" style={{ flexShrink: 0 }}>
      <LogOut size={16} />
    </ActionIcon>
  );
};

export default LogoutButton;
