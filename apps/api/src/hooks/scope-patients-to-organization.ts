import { Hook, HookContext } from '@feathersjs/feathers';
import { Sequelize, QueryTypes } from 'sequelize';

/**
 * Before-find hook: restricts `patients.find` to only return patients
 * that belong to the current organization (via the organization_patients
 * junction table).  When no organizationId is in context the hook is a
 * no-op so internal/admin calls still work.
 */
export const scopePatientsToOrganization = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;
    const organizationId = params.organizationId;

    if (!organizationId) {
      return context;
    }

    const sequelize: Sequelize = app.get('sequelizeClient');

    const rows = await sequelize.query<{ patientId: string }>(
      'SELECT "patientId" FROM "organization_patients" WHERE "organizationId" = :orgId',
      {
        replacements: { orgId: organizationId },
        type: QueryTypes.SELECT
      }
    );

    const patientIds = rows.map(r => r.patientId);

    if (patientIds.length === 0) {
      context.params.query = {
        ...context.params.query,
        id: 'none'
      };
      return context;
    }

    const existingIdFilter = context.params.query?.id;
    if (existingIdFilter) {
      const requestedIds = Array.isArray(existingIdFilter.$in)
        ? existingIdFilter.$in
        : [existingIdFilter];
      const filtered = requestedIds.filter((id: string) => patientIds.includes(id));
      context.params.query = {
        ...context.params.query,
        id: { $in: filtered.length > 0 ? filtered : ['none'] }
      };
    } else {
      context.params.query = {
        ...context.params.query,
        id: { $in: patientIds }
      };
    }

    return context;
  };
};
