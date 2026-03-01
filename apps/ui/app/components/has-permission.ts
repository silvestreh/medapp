import React from 'react';
import intersection from 'lodash/intersection';
import { useAccount, useOrganization } from '~/components/provider';

interface HasPermissionProps {
  permissions: string[];
  children: React.ReactNode;
}

const HasPermission: React.FC<HasPermissionProps> = ({ permissions, children }) => {
  const { user } = useAccount();
  const { currentOrganizationId } = useOrganization();

  if (!user) {
    return null;
  }

  if (permissions.length === 0) {
    return children;
  }

  const currentOrg = user.organizations?.find(o => o.id === currentOrganizationId);
  const orgPermissions = currentOrg?.permissions ?? [];
  const hasPermission = intersection(permissions, orgPermissions).length > 0;

  return hasPermission ? children : null;
};

export default HasPermission;
