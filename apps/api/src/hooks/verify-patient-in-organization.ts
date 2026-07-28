import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden, NotFound } from '@feathersjs/errors';

interface VerifyOptions {
  /** Where to read the patient id from: the hook context id (get) or a query key (find). */
  source?: 'id' | 'query';
  queryKey?: string;
}

/**
 * Verifies the targeted patient belongs to the active organization (via the
 * organization_patients junction) before letting an external request through.
 * Super admins skip the check (params.isSuperAdmin is set by
 * verifyOrganizationMembership).
 */
const verifyPatientInOrganization = (options: VerifyOptions = {}): Hook => {
  const { source = 'id', queryKey = 'patientId' } = options;

  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;

    if (params.provider === undefined || !params.user) return context;
    if (params.isSuperAdmin) return context;

    if (!params.organizationId) {
      throw new Forbidden('An organization context is required');
    }

    const patientId = source === 'id' ? context.id : context.params.query?.[queryKey];
    if (!patientId) return context;

    const links = (await app.service('organization-patients').find({
      query: {
        organizationId: params.organizationId,
        patientId: String(patientId),
      },
      paginate: false,
    })) as any[];

    if (!links.length) {
      throw new NotFound(`No record found for id '${patientId}'`);
    }

    return context;
  };
};

export default verifyPatientInOrganization;
