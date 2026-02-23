import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

const restrictToOrgOwner = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, id, params } = context;
  const userId = params.user?.id;
  if (!userId || !id) throw new Forbidden('Not allowed');

  const memberships: any[] = await app.service('organization-users').find({
    query: { organizationId: id, userId, role: 'owner' },
    paginate: false,
  } as any);

  if (memberships.length === 0) {
    throw new Forbidden('Only the organization owner can perform this action');
  }

  return context;
};

export default restrictToOrgOwner;
