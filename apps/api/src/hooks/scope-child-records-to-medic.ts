import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden, NotFound } from '@feathersjs/errors';
import { findShareGrants, hasShareGrant } from '../utils/shared-medic-access';

interface ChildScopeOptions {
  /** Service holding the parent (medicId, patientId, organizationId) records. */
  parentService: string;
  /** Column on this service referencing the parent record. */
  foreignKey: string;
}

/**
 * Scopes external provider access on services whose records have no
 * medicId/organizationId of their own and derive ownership through a parent
 * record — e.g. sire-readings / sire-dose-schedules / sire-dose-logs via
 * treatmentId → sire-treatments, study-results via studyId → studies.
 *
 * A parent record is accessible when it belongs to the active organization
 * and the medic owns it, holds a share grant for its patient, or has the
 * `<parentService>:find:all` permission.
 *
 * - before find: constrains the foreignKey to accessible parent ids.
 * - before create/patch/remove: verifies the (target) parent is accessible.
 * - after get: verifies the fetched record's parent is accessible.
 *
 * Internal calls and patient-token requests (handled by scope-to-patient
 * hooks) are skipped.
 */
const scopeChildRecordsToMedic = ({ parentService, foreignKey }: ChildScopeOptions): Hook => {
  const orgWidePermission = `${parentService}:find:all`;

  const canAccessParent = async (context: HookContext, parent: any): Promise<boolean> => {
    const { app, params } = context;
    const userId = String(params.user?.id);

    // Legacy parents may have no organizationId (same tolerance as checkPermissions)
    if (parent.organizationId && String(parent.organizationId) !== String(params.organizationId)) {
      return false;
    }

    const permissions: string[] = params.orgPermissions || [];
    if (permissions.includes(orgWidePermission)) {
      return true;
    }

    if (String(parent.medicId) === userId) {
      return true;
    }

    return hasShareGrant(app, {
      grantingMedicId: parent.medicId,
      grantedMedicId: userId,
      patientId: parent.patientId,
      organizationId: params.organizationId,
    });
  };

  const getAccessibleParentIds = async (context: HookContext): Promise<string[]> => {
    const { app, params } = context;
    const userId = String(params.user?.id);

    const parents = (await app.service(parentService).find({
      query: {
        organizationId: params.organizationId,
        $select: ['id', 'medicId', 'patientId'],
      },
      paginate: false,
    })) as any[];

    const permissions: string[] = params.orgPermissions || [];
    if (permissions.includes(orgWidePermission)) {
      return parents.map((parent) => String(parent.id));
    }

    const grants = await findShareGrants(app, userId, params.organizationId);
    const sharedKeys = new Set(
      grants.map((grant) => `${grant.grantingMedicId}:${grant.patientId}`)
    );

    return parents
      .filter(
        (parent) =>
          String(parent.medicId) === userId ||
          sharedKeys.has(`${parent.medicId}:${parent.patientId}`)
      )
      .map((parent) => String(parent.id));
  };

  return async (context: HookContext): Promise<HookContext> => {
    const { app, params, method } = context;

    if (params.provider === undefined || !params.user || params.patient) {
      return context;
    }

    if (context.type === 'before' && context.result !== undefined) {
      return context;
    }

    if (!params.organizationId) {
      throw new Forbidden('An organization context is required to access these records');
    }

    if (context.type === 'before' && method === 'find') {
      const accessibleIds = await getAccessibleParentIds(context);
      const requested = context.params.query?.[foreignKey];

      if (typeof requested === 'string') {
        if (!accessibleIds.includes(requested)) {
          throw new Forbidden('Cannot access these records');
        }
      } else if (requested && Array.isArray(requested.$in)) {
        const allowed = requested.$in.filter((value: string) => accessibleIds.includes(String(value)));
        context.params.query = {
          ...context.params.query,
          [foreignKey]: { $in: allowed },
        };
      } else {
        context.params.query = {
          ...context.params.query,
          [foreignKey]: { $in: accessibleIds },
        };
      }

      return context;
    }

    if (context.type === 'before' && method === 'create') {
      const parentId = context.data?.[foreignKey];
      if (!parentId) {
        throw new Forbidden(`${foreignKey} is required`);
      }

      const parent: any = await app.service(parentService).get(parentId);
      if (!(await canAccessParent(context, parent))) {
        throw new Forbidden('Cannot create records for this parent record');
      }

      // Keep denormalized columns consistent with the parent (extra keys are
      // ignored by models that don't define them)
      context.data = {
        ...context.data,
        patientId: parent.patientId,
        organizationId: parent.organizationId,
      };

      return context;
    }

    if (context.type === 'before' && (method === 'patch' || method === 'remove')) {
      if (context.id === undefined || context.id === null) {
        throw new Forbidden('ID is required for this operation');
      }

      const record: any = await context.service.get(context.id, { provider: undefined, query: {} });
      const parent: any = await app.service(parentService).get(record[foreignKey]);
      if (!(await canAccessParent(context, parent))) {
        throw new Forbidden('Cannot modify records for this parent record');
      }

      return context;
    }

    if (context.type === 'after' && method === 'get' && context.result) {
      const parent: any = await app.service(parentService).get(context.result[foreignKey]);
      if (!(await canAccessParent(context, parent))) {
        throw new NotFound(`No record found for id '${context.id}'`);
      }

      return context;
    }

    return context;
  };
};

export default scopeChildRecordsToMedic;
