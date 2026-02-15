import { Hook, HookContext } from '@feathersjs/feathers';

interface StudyResultInput {
  type: string;
  data: Record<string, any>;
}

export default function extractStudyResults(): Hook {
  return async (context: HookContext) => {
    const data = context.data || {};
    const { results, id, ...rest } = data;

    if (Array.isArray(results)) {
      const normalizedResults = results
        .filter((item: any) => item && typeof item.type === 'string' && item.type.trim() !== '')
        .map((item: any) => ({
          type: item.type,
          data: item.data || {},
        })) as StudyResultInput[];

      context.params._studyResultsPayload = normalizedResults;
    }

    // `id` and `results` are accepted in the payload contract but not persisted on studies table.
    context.data = rest;
    return context;
  };
}
