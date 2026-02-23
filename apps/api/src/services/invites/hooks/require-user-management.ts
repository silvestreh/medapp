import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import { getUserPermissions } from '../../../utils/get-user-permissions';

const requireUserManagement = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, params } = context;
  if (params.provider === undefined || !params.user) return context;

  const permissions = await getUserPermissions(app, params.user.id, params.user.roleId);
  if (!permissions.includes('users:create') && !permissions.includes('users:create:all')) {
    throw new Forbidden('You do not have permission to invite users');
  }
  return context;
};

export default requireUserManagement;
