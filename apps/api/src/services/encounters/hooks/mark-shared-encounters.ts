import { Hook, HookContext } from '@feathersjs/feathers';

export const markSharedEncounters = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { params, method } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    const userId = params.user.id;

    if (method === 'get') {
      if (context.result && context.result.medicId !== userId) {
        context.result.readOnly = true;
        context.result.sharedBy = context.result.medicId;
      }
    }

    if (method === 'find') {
      const data = context.result.data || context.result;
      if (Array.isArray(data)) {
        for (const encounter of data) {
          if (encounter.medicId !== userId) {
            encounter.readOnly = true;
            encounter.sharedBy = encounter.medicId;
          }
        }
      }
    }

    return context;
  };
};
