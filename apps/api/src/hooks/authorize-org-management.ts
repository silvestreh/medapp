import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

const PRIVILEGED_ROLES = ['admin', 'owner'];

export const authorizeOrgManagement = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (!params.provider || !params.user) {
      return context;
    }

    if (params.isSuperAdmin) {
      return context;
    }

    const orgRoleIds: string[] = params.orgRoleIds || [];
    const isOwner = orgRoleIds.includes('owner');
    const isAdmin = orgRoleIds.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new Forbidden('You do not have permission to manage organization members');
    }

    const servicePath = context.path;
    const method = context.method;

    if (servicePath === 'user-roles') {
      const targetRoleId = method === 'create'
        ? context.data?.roleId
        : undefined;

      if (method === 'remove' && context.id) {
        const record = await context.app.service('user-roles').get(context.id, { provider: undefined } as any);
        if (record) {
          if (record.roleId === 'owner') {
            throw new Forbidden('The owner role cannot be removed');
          }
          if (!isOwner && PRIVILEGED_ROLES.includes(record.roleId)) {
            throw new Forbidden('Only the organization owner can manage admin and owner roles');
          }
        }
      }

      if (method === 'create' && targetRoleId && !isOwner && PRIVILEGED_ROLES.includes(targetRoleId)) {
        throw new Forbidden('Only the organization owner can assign admin and owner roles');
      }
    }

    if (servicePath === 'organization-users' && method === 'remove' && context.id) {
      if (!isOwner) {
        const membership = await context.app.service('organization-users').get(context.id, { provider: undefined } as any);
        if (membership) {
          const targetUserRoles: any[] = await context.app.service('user-roles').find({
            query: { userId: membership.userId, organizationId: params.organizationId },
            paginate: false,
          } as any);
          const targetRoleIds = targetUserRoles.map((ur: any) => ur.roleId);
          if (targetRoleIds.some((r: string) => PRIVILEGED_ROLES.includes(r))) {
            throw new Forbidden('Only the organization owner can remove admins and owners');
          }
        }
      }
    }

    return context;
  };
};
