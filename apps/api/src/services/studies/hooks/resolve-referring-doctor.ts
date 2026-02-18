import { Hook, HookContext } from '@feathersjs/feathers';
import type { Study } from '../../../declarations';

/**
 * Before hook: when medicId is set, ensure referringDoctor is null in the DB.
 * The name is derived at read time from the user record instead.
 */
export function clearReferringDoctor(): Hook {
  return async (context: HookContext) => {
    if (context.data?.medicId) {
      context.data.referringDoctor = null;
    }
    return context;
  };
}

/**
 * After hook: populate referringDoctor from the user's personal data
 * for studies that have a medicId (where referringDoctor is null in the DB).
 */
export function populateReferringDoctor(): Hook {
  return async (context: HookContext) => {
    const { app, result, method } = context;

    const studies: Study[] = method === 'find'
      ? (Array.isArray(result) ? result : result.data)
      : [result];

    if (!studies?.length) return context;

    const medicIds = [...new Set(
      studies.map(s => s.medicId).filter(Boolean) as string[]
    )];

    if (medicIds.length === 0) return context;

    const users = await app.service('users').find({
      query: { id: { $in: medicIds } },
      paginate: false,
    });

    const userMap = new Map(
      (users as any[]).map(u => [u.id, u])
    );

    for (const study of studies) {
      if (study.medicId && !study.referringDoctor) {
        const user = userMap.get(study.medicId);
        if (user) {
          const firstName = user.personalData?.firstName || '';
          const lastName = user.personalData?.lastName || '';
          (study as any).referringDoctor = `${firstName} ${lastName}`.trim() || null;
        }
      }
    }

    return context;
  };
}
