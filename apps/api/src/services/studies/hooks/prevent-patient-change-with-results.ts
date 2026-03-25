import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

export default function preventPatientChangeWithResults(): Hook {
  return async (context: HookContext) => {
    const { app, data, id, service, params } = context;

    if (!data?.patientId || !id) return context;
    if (params.provider === undefined) return context;

    const existing = await service.get(id, { ...params, provider: undefined });

    if (existing.patientId === data.patientId) return context;

    const results = await app.service('study-results').find({
      query: { studyId: id, $limit: 1 },
      paginate: false,
    }) as any[];

    if (results.length > 0) {
      throw new BadRequest('Cannot change patient on a study that has results');
    }

    return context;
  };
}
