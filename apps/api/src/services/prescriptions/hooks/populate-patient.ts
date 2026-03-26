import { Hook, HookContext } from '@feathersjs/feathers';

export const populatePatient = (): Hook => {
  return async (context: HookContext) => {
    const { app, result, method } = context;

    const records = method === 'find'
      ? Array.isArray(result) ? result : result.data
      : [result];

    if (!records?.length) return context;

    const uniquePatientIds = [...new Set(
      records.map((r: any) => r.patientId).filter(Boolean)
    )];

    if (uniquePatientIds.length === 0) return context;

    const patients = await app.service('patients').find({
      query: { id: { $in: uniquePatientIds } },
      paginate: false,
      disableSoftDelete: true,
    });

    const patientMap = new Map(
      (patients as any[]).map((p: any) => [p.id, p])
    );

    records.forEach((record: any) => {
      record.patient = patientMap.get(record.patientId) || null;
    });

    return context;
  };
};
