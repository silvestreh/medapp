import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import {
  findShareGrants,
  hasShareGrant,
  ownOrSharedConditions,
} from '../utils/shared-medic-access';

interface RestrictOptions {
  /** Write methods that medics holding a share grant may also perform. */
  sharedWrites?: Array<'patch' | 'remove'>;
}

/**
 * Restricts external provider access on services whose records carry
 * (medicId, patientId, organizationId) — e.g. studies, sire-treatments.
 *
 * - Requires an organization context and always scopes to it.
 * - A `<path>:<method>:all` permission grants org-wide access.
 * - find: own records plus records shared with the medic through
 *   shared-encounter-access grants. The condition is appended under $and so
 *   search hooks that build their own $or (e.g. searchStudies) are not
 *   clobbered.
 * - get: own, shared (sets params.isSharedAccess) or :all.
 * - create: forces organizationId, and medicId for non-:all users.
 * - patch/remove: own records only, unless listed in options.sharedWrites.
 *
 * Internal calls and patient-token requests (handled by scope-to-patient
 * hooks) are skipped.
 */
const restrictToMedicWithShares = (options: RestrictOptions = {}): Hook => {
  const sharedWrites = options.sharedWrites || [];

  return async (context: HookContext): Promise<HookContext> => {
    const { app, params, method, id, service, path } = context;

    if (params.provider === undefined || !params.user || params.patient) {
      return context;
    }

    // A previous hook (e.g. mockTestUser) may have already resolved the result
    if (context.result !== undefined) {
      return context;
    }

    const organizationId = params.organizationId;
    if (!organizationId) {
      throw new Forbidden('An organization context is required to access these records');
    }

    const permissions: string[] = params.orgPermissions || [];
    const hasAllPermission = permissions.includes(`${path}:${method}:all`);

    if (method === 'create') {
      context.data = {
        ...context.data,
        organizationId,
        ...(hasAllPermission ? {} : { medicId: params.user.id }),
      };
      return context;
    }

    if (method === 'find') {
      const query: Record<string, any> = { ...context.params.query, organizationId };

      if (!hasAllPermission) {
        const grants = await findShareGrants(app, params.user.id, organizationId);
        query.$and = [
          ...(query.$and || []),
          { $or: ownOrSharedConditions(params.user.id, grants) },
        ];
      }

      context.params.query = query;
      return context;
    }

    // get / patch / remove — id-based methods
    if (id === undefined || id === null) {
      throw new Forbidden('ID is required for this operation');
    }

    const record: any = await service.get(id, { provider: undefined, query: {} });

    // Legacy records may have no organizationId (same tolerance as checkPermissions)
    if (record.organizationId && String(record.organizationId) !== String(organizationId)) {
      throw new Forbidden('This record belongs to a different organization');
    }

    if (hasAllPermission || String(record.medicId) === String(params.user.id)) {
      return context;
    }

    const shareUsable = method === 'get' || sharedWrites.includes(method as 'patch' | 'remove');
    if (shareUsable) {
      const shared = await hasShareGrant(app, {
        grantingMedicId: record.medicId,
        grantedMedicId: params.user.id,
        patientId: record.patientId,
        organizationId,
      });

      if (shared) {
        context.params.isSharedAccess = true;
        return context;
      }
    }

    throw new Forbidden('You can only access your own records');
  };
};

export default restrictToMedicWithShares;
