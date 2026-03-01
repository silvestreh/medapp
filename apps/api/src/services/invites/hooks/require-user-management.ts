import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest, Forbidden } from '@feathersjs/errors';
import { getUserPermissions } from '../../../utils/get-user-permissions';

const PRIVILEGED_ROLES = ['admin', 'owner'];

const requireUserManagement = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, params } = context;
  if (params.provider === undefined || !params.user) return context;

  if (params.isSuperAdmin) return context;

  if (!params.organizationId) {
    throw new BadRequest('Organization context is required');
  }

  const permissions: string[] = params.orgPermissions
    || await getUserPermissions(app, params.user.id, params.organizationId);

  if (!permissions.includes('users:create') && !permissions.includes('users:create:all')) {
    throw new Forbidden('You do not have permission to invite users');
  }

  const orgRoleIds: string[] = params.orgRoleIds || [];
  const isOwner = orgRoleIds.includes('owner');

  const inviteRoleId = context.data?.roleId;
  if (inviteRoleId && !isOwner && PRIVILEGED_ROLES.includes(inviteRoleId)) {
    throw new Forbidden('Only the organization owner can invite admins and owners');
  }

  if (inviteRoleId) {
    try {
      await app.service('roles').get(inviteRoleId);
    } catch {
      throw new BadRequest(`Invalid roleId: ${inviteRoleId}`);
    }
  }

  return context;
};

export default requireUserManagement;
