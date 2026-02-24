import { HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const restrictUserToOrganization = () => async (context: HookContext): Promise<HookContext> => {
  const { app, id, params } = context;

  if (!params.provider || !params.organizationId) return context;

  const memberships: any[] = await app.service('organization-users').find({
    query: { organizationId: params.organizationId },
    paginate: false,
  } as any);

  const userIds = memberships.map((m: any) => String(m.userId));
  if (!userIds.includes(String(id))) {
    throw new Forbidden('You do not have access to this user');
  }

  return context;
};
