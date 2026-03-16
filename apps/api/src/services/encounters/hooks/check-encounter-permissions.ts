import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import { checkPermissions } from '../../../hooks/check-permissions';

export const checkEncounterPermissions = (): Hook => {
  const baseCheck = checkPermissions({ foreignKey: 'medicId' });

  return async (context: HookContext): Promise<HookContext> => {
    const { method, params } = context;

    // Break the Glass: allow a medic to access ALL encounters for a patient
    const btgFlag = params.query?.btg;
    if (btgFlag === true || btgFlag === 'true') {
      if (params.provider === undefined || !params.user) {
        // Internal calls don't need BTG
        delete params.query!.btg;
        return context;
      }

      const orgRoleIds: string[] = params.orgRoleIds || [];
      if (!orgRoleIds.includes('medic')) {
        throw new Forbidden('Only medics can use Break the Glass emergency access');
      }

      // Strip btg from query so Sequelize doesn't try to filter by it
      delete params.query!.btg;

      // Signal downstream hooks to skip normal permission scoping
      params.btgAccess = true;
      params.accessPurpose = 'emergency';

      return context;
    }

    if (method !== 'get') {
      await baseCheck(context);
      return context;
    }

    // For get: try normal permissions first, fall back to shared access check
    try {
      await baseCheck(context);
      return context;
    } catch (error) {
      if (!(error instanceof Forbidden) || params.provider === undefined || !params.user) {
        throw error;
      }

      const { app, id } = context;

      const record = await context.service.get(id!, {
        ...params,
        provider: undefined
      });

      const grants = await app.service('shared-encounter-access').find({
        query: {
          grantingMedicId: record.medicId,
          grantedMedicId: params.user.id,
          patientId: record.patientId,
          organizationId: params.organizationId
        },
        paginate: false,
        provider: undefined
      });

      if (!Array.isArray(grants) || grants.length === 0) {
        throw error;
      }

      context.params.isSharedAccess = true;
      return context;
    }
  };
};
