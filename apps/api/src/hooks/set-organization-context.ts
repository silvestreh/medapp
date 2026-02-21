import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

/**
 * Reads the `organization-id` header from external requests and validates
 * that the authenticated user belongs to that organization.  The resolved
 * organizationId is stored at `params.organizationId` so downstream hooks
 * and services can use it for scoping.
 */
export const setOrganizationContext = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    const organizationId =
      params.headers?.['organization-id'] ||
      params.query?.organizationId;

    if (!organizationId) {
      return context;
    }

    const memberships: any[] = await app.service('organization-users').find({
      query: { userId: params.user.id, organizationId },
      paginate: false
    } as any);

    if (memberships.length === 0) {
      throw new Forbidden('You are not a member of this organization');
    }

    params.organizationId = organizationId;

    if (params.query?.organizationId) {
      delete params.query.organizationId;
    }

    return context;
  };
};
