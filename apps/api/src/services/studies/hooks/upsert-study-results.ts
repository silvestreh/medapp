import { Hook, HookContext } from '@feathersjs/feathers';

interface StudyResultInput {
  type: string;
  data: Record<string, any>;
}

export default function upsertStudyResults(): Hook {
  return async (context: HookContext) => {
    const { app, result } = context;
    const payload = context.params._studyResultsPayload as StudyResultInput[] | undefined;

    if (!payload || payload.length === 0) {
      return context;
    }

    const studies = Array.isArray(result) ? result : [result];
    const studyResultsService = app.service('study-results');

    for (const study of studies) {
      for (const entry of payload) {
        const existing = await studyResultsService.find({
          query: {
            studyId: study.id,
            type: entry.type,
            $limit: 1
          },
          paginate: false
        }) as any[];

        if (existing.length > 0) {
          await studyResultsService.patch(existing[0].id, { data: entry.data });
        } else {
          await studyResultsService.create({
            studyId: study.id,
            type: entry.type,
            data: entry.data
          });
        }
      }
    }

    return context;
  };
}
