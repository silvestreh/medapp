import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

const restrictToOrgOwner = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { params } = context;

  if (!params.provider || !params.user) return context;

  if (params.isSuperAdmin) return context;

  const orgRoleIds: string[] = params.orgRoleIds || [];
  if (!orgRoleIds.includes('owner') && !orgRoleIds.includes('admin')) {
    throw new Forbidden('Only organization owners and admins can perform this action');
  }

  return context;
};

export default restrictToOrgOwner;
