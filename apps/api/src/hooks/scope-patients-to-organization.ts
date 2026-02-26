import { Hook, HookContext } from '@feathersjs/feathers';
import type { OrganizationPatient } from '../declarations';

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

    const orgPatients = await app.service('organization-patients').find({
      query: { organizationId },
      paginate: false,
    }) as OrganizationPatient[];

    const patientIds = orgPatients.map(r => r.patientId as string);

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
