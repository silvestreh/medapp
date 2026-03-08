import { Hook, HookContext } from '@feathersjs/feathers';

export const applySharedAccess = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, params } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    // checkEncounterPermissions already set medicId in the query for find.
    // We need to broaden it to also include encounters shared with this user.
    const grants = await app.service('shared-encounter-access').find({
      query: {
        grantedMedicId: params.user.id,
        organizationId: params.organizationId,
        $limit: 50
      },
      paginate: false,
      provider: undefined
    }) as any[];

    if (!grants || grants.length === 0) {
      return context;
    }

    // Build per-grant (medicId, patientId) pairs
    const sharedConditions = grants.map((grant: any) => ({
      medicId: grant.grantingMedicId,
      patientId: grant.patientId
    }));

    // Replace the simple medicId filter with an $or that includes both
    // own encounters and shared encounters
    const currentQuery = { ...context.params.query };
    delete currentQuery.medicId;

    context.params.query = {
      ...currentQuery,
      $or: [
        { medicId: params.user.id },
        ...sharedConditions
      ]
    };

    return context;
  };
};
