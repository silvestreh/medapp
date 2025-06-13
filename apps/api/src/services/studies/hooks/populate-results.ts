import { Hook, HookContext } from '@feathersjs/feathers';
import type { Study, StudyResult } from '../../../declarations';

export default function populateResults(): Hook {
  return async (context: HookContext) => {
    const { app, result, method } = context;

    const studies = method === 'find'
      ? Array.isArray(result) ? result : result.data
      : [result];

    if (!studies?.length) return context;

    const results: StudyResult[] = await app.service('study-results').find({
      query: {
        studyId: { $in: studies.map((study: Study) => study.id) }
      },
      paginate: false
    });

    studies.forEach((study: Study) => {
      study.results = results.filter((r: StudyResult) => r.studyId === study.id);
    });

    return context;
  };
}
