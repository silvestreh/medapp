import React from 'react';
import { Button } from '@mantine/core';
import { LogOut } from 'lucide-react';

import { useAccount } from '~/components/provider';

const LogoutButton: React.FC = () => {
  const { logout } = useAccount();

  return (
    <Button onClick={logout} variant="subtle">
      <LogOut size={16} />
    </Button>
  );
};

export default LogoutButton;
