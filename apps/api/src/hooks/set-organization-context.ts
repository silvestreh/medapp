import { Hook, HookContext } from '@feathersjs/feathers';

/**
 * Reads the `organization-id` header (or query param) from external requests
 * and stores it at `params.organizationId` so downstream hooks can use it
 * for scoping.
 *
 * This runs as an app-level before hook (before service-level authenticate),
 * so params.user is not yet available. Membership validation should happen
 * in service-level hooks that run after authenticate.
 */
export const setOrganizationContext = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params } = context;

    if (params.provider === undefined) {
      return context;
    }

    const organizationId =
      params.headers?.['organization-id'] ||
      params.query?.organizationId;

    if (!organizationId) {
      return context;
    }

    params.organizationId = organizationId;

    if (params.query?.organizationId) {
      delete params.query.organizationId;
    }

    return context;
  };
};
