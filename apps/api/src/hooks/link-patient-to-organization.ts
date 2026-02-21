import { Hook, HookContext } from '@feathersjs/feathers';

/**
 * After-create hook for patients: links the newly created patient to the
 * current organization via organization_patients.
 */
export const linkPatientToOrganization = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, result, params } = context;
    const organizationId = params.organizationId;

    if (!organizationId || !result?.id) {
      return context;
    }

    const existing: any[] = await app.service('organization-patients').find({
      query: { organizationId, patientId: result.id },
      paginate: false
    } as any);

    if (existing.length === 0) {
      await app.service('organization-patients').create({
        organizationId,
        patientId: result.id
      });
    }

    return context;
  };
};
