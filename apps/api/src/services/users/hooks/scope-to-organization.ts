import { HookContext } from '@feathersjs/feathers';

export const scopeUsersToOrganization = () => async (context: HookContext): Promise<HookContext> => {
  const { app, params } = context;

  if (!params.provider || !params.organizationId) return context;

  const memberships: any[] = await app.service('organization-users').find({
    query: { organizationId: params.organizationId },
    paginate: false,
  } as any);

  const userIds = memberships.map((m: any) => m.userId);

  context.params.query = {
    ...context.params.query,
    id: { $in: userIds },
  };

  return context;
};
