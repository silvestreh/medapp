import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const verifyOrganizationMembership = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;

    if (!params.provider || !params.organizationId || !params.user) {
      return context;
    }

    const memberships: any[] = await app.service('organization-users').find({
      query: { userId: params.user.id, organizationId: params.organizationId },
      paginate: false,
    } as any);

    if (memberships.length === 0) {
      throw new Forbidden('You are not a member of this organization');
    }

    return context;
  };
};
