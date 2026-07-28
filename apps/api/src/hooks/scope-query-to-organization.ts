import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

/**
 * Forces the active organization onto the query of external find/get requests
 * (feathers-sequelize merges params.query into the where clause on get too).
 * Unlike hooks that no-op without an org context, this one requires it, so
 * omitting the organization-id header cannot widen the results.
 */
const scopeQueryToOrganization = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (context.params.provider === undefined) return context;

  if (!context.params.organizationId) {
    throw new Forbidden('An organization context is required');
  }

  context.params.query = {
    ...context.params.query,
    organizationId: context.params.organizationId,
  };

  return context;
};

export default scopeQueryToOrganization;
