import React, { useCallback } from 'react';
import { ActionIcon } from '@mantine/core';
import { LogOut } from 'lucide-react';

import { useAccount } from '~/components/provider';
import { useChat } from '~/components/chat/chat-provider';

const LogoutButton: React.FC = () => {
  const { logout } = useAccount();
  const { chatClient } = useChat();

  const handleLogout = useCallback(async () => {
    try {
      if (chatClient) {
        const socket = (chatClient as any).io;
        if (socket) {
          socket.disconnect();
        }
      }
    } catch {
      // ignore chat disconnect errors
    }
    await logout();
  }, [chatClient, logout]);

  return (
    <ActionIcon onClick={handleLogout} size="2.5em" variant="subtle" style={{ flexShrink: 0 }}>
      <LogOut size={16} />
    </ActionIcon>
  );
};

export default LogoutButton;
