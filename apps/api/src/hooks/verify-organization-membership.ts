import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const verifyOrganizationMembership = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;

    if (!params.provider || !params.user) {
      return context;
    }

    if (params.user.isSuperAdmin) {
      params.isSuperAdmin = true;
    }

    if (!params.organizationId) {
      return context;
    }

    const sequelize = app.get('sequelizeClient');
    const { organization_users, organizations } = sequelize.models;

    if (params.isSuperAdmin) {
      const org = await organizations.findByPk(params.organizationId, {
        attributes: ['isActive'],
        raw: true,
      });
      if (org) {
        params.isOrgActive = org.isActive;
      }
      return context;
    }

    const membership = await organization_users.findOne({
      where: { userId: params.user.id, organizationId: params.organizationId },
      raw: true,
    });

    if (!membership) {
      throw new Forbidden('You are not a member of this organization');
    }

    const { user_roles, roles } = sequelize.models;
    const userRoleRows = await user_roles.findAll({
      where: { userId: params.user.id, organizationId: params.organizationId },
      include: [{ model: roles, attributes: ['id', 'permissions'] }],
      raw: true,
      nest: true,
    });

    const orgRoleIds: string[] = [];
    const allPermissions: string[] = [];

    for (const row of userRoleRows) {
      orgRoleIds.push(row.roleId);
      const rolePerms = (row as any).role?.permissions;
      if (Array.isArray(rolePerms)) {
        allPermissions.push(...rolePerms);
      }
    }

    params.orgRoleIds = orgRoleIds;
    params.orgPermissions = [...new Set(allPermissions)];

    const org = await organizations.findByPk(params.organizationId, {
      attributes: ['isActive'],
      raw: true,
    });
    if (org) {
      params.isOrgActive = org.isActive;
    }

    return context;
  };
};
