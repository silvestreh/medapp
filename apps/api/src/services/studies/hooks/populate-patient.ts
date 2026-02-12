import { Hook, HookContext } from '@feathersjs/feathers';
import type { Study } from '../../../declarations';

export default function populatePatient(): Hook {
  return async (context: HookContext) => {
    const { app, result, method } = context;

    const studies = method === 'find'
      ? Array.isArray(result) ? result : result.data
      : [result];

    if (!studies?.length) return context;

    const uniquePatientIds = [...new Set(
      studies.map((s: Study) => s.patientId).filter(Boolean)
    )];

    if (uniquePatientIds.length === 0) return context;

    const patients = await app.service('patients').find({
      query: {
        id: { $in: uniquePatientIds },
      },
      paginate: false,
    });

    const patientMap = new Map(
      (patients as any[]).map((p: any) => [p.id, p])
    );

    studies.forEach((study: Study) => {
      (study as any).patient = patientMap.get(study.patientId) || null;
    });

    return context;
  };
}
