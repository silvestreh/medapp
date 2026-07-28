import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

/**
 * Rejects external requests that omit the organization-id header. Hooks that
 * scope by params.organizationId silently no-op without it, so services
 * relying on them must make the org context mandatory explicitly.
 */
const requireOrganizationContext = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (context.params.provider === undefined) return context;

  if (!context.params.organizationId) {
    throw new Forbidden('An organization context is required');
  }

  return context;
};

export default requireOrganizationContext;
