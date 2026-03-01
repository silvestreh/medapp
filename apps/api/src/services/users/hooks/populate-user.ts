import { HookContext } from '@feathersjs/feathers';

const populateUser = () => {
  return async (context: HookContext) => {
    const { app, result } = context;

    const hasMedicInAnyOrg = async (): Promise<boolean> => {
      if (result.isSuperAdmin) return false;
      const medicRoles: any[] = await app.service('user-roles').find({
        query: { userId: result.id, roleId: 'medic' },
        paginate: false,
      } as any);
      return medicRoles.length > 0;
    };

    if (await hasMedicInAnyOrg()) {
      const [settings] = await app.service('md-settings').find({
        query: { userId: result.id },
        paginate: false
      });
      result.settings = settings;
    }

    const memberships: any[] = await app.service('organization-users').find({
      query: { userId: result.id },
      paginate: false
    } as any);

    if (memberships.length > 0) {
      const orgIds = memberships.map((m: any) => m.organizationId);
      const orgs = await Promise.all(
        orgIds.map((id: string) => app.service('organizations').get(id))
      );

      const userRolesAll: any[] = await app.service('user-roles').find({
        query: { userId: result.id },
        paginate: false,
      } as any);

      const rolesByOrg = new Map<string, string[]>();
      for (const ur of userRolesAll) {
        const existing = rolesByOrg.get(ur.organizationId) || [];
        existing.push(ur.roleId);
        rolesByOrg.set(ur.organizationId, existing);
      }

      const allRoleIds = [...new Set(userRolesAll.map((ur: any) => ur.roleId))];
      const roleRecords = await Promise.all(
        allRoleIds.map((roleId: string) =>
          app.service('roles').get(roleId).catch(() => null)
        )
      );
      const permsByRole = new Map<string, string[]>();
      for (const record of roleRecords) {
        if (record) {
          permsByRole.set(record.id, record.permissions || []);
        }
      }

      result.organizations = orgs.map((org: any) => {
        const orgRoleIds = rolesByOrg.get(org.id) || [];
        const orgPerms = [...new Set(
          orgRoleIds.flatMap((rId: string) => permsByRole.get(rId) || [])
        )];
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          isActive: org.isActive,
          roleIds: orgRoleIds,
          permissions: orgPerms,
        };
      });
    } else {
      result.organizations = [];
    }

    context.result = result;

    return context;
  };
};

export default populateUser;
