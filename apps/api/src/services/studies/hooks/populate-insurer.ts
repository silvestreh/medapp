import { Hook, HookContext } from '@feathersjs/feathers';
import type { Study } from '../../../declarations';

export default function populateInsurer(): Hook {
  return async (context: HookContext) => {
    const { app, result, method } = context;

    const studies = method === 'find'
      ? Array.isArray(result) ? result : result.data
      : [result];

    if (!studies?.length) return context;

    const uniqueInsurerIds = [...new Set(
      studies.map((s: Study) => (s as any).insurerId).filter(Boolean)
    )];

    if (uniqueInsurerIds.length === 0) return context;

    const insurers = await app.service('prepagas').find({
      query: {
        id: { $in: uniqueInsurerIds },
      },
      paginate: false,
    });

    const insurerMap = new Map(
      (insurers as any[]).map((i: any) => [i.id, i])
    );

    studies.forEach((study: Study) => {
      (study as any).insurer = insurerMap.get((study as any).insurerId) || null;
    });

    return context;
  };
}
