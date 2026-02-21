import { HookContext } from '@feathersjs/feathers';
import { getUserPermissions } from '../../../utils/get-user-permissions';

const populateUser = () => {
  return async (context: HookContext) => {
    const { app, result } = context;

    if (result.roleId) {
      const mergedPermissions = await getUserPermissions(app, result.id, result.roleId);

      result.role = {
        id: result.roleId,
        permissions: mergedPermissions
      };
    }

    if (result.roleId === 'medic') {
      const [settings] = await app.service('md-settings').find({
        query: {
          userId: result.id
        },
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

      result.organizations = orgs.map((org: any, i: number) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: memberships[i].role
      }));
    } else {
      result.organizations = [];
    }

    context.result = result;

    return context;
  };
};

export default populateUser;
