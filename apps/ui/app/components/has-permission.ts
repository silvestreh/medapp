import React from 'react';
import intersection from 'lodash/intersection';
import { useAccount } from '~/components/provider';

interface HasPermissionProps {
  permissions: string[];
  children: React.ReactNode;
}

const HasPermission: React.FC<HasPermissionProps> = ({ permissions, children }) => {
  const { user } = useAccount();

  if (!user) {
    return null;
  }

  if (permissions.length === 0) {
    return children;
  }

  const hasPermission = intersection(permissions, user.role?.permissions || []).length > 0;

  return hasPermission ? children : null;
};

export default HasPermission;
