import { Hook, HookContext } from '@feathersjs/feathers';

export const addDuration = (): Hook => {
  return async (context: HookContext) => {
    const { app, method, result } = context;

    const fetchDuration = async (appointment: any) => {
      if (appointment.medicId) {
        const mdSettings = await app.service('md-settings').find({
          query: { userId: appointment.medicId },
          paginate: false
        });

        if (mdSettings.length > 0) {
          appointment.duration = mdSettings[0].encounterDuration;
        }
      }
    };

    if (method === 'find') {
      if (Array.isArray(result.data)) {
        await Promise.all(result.data.map(fetchDuration));
      } else if (Array.isArray(result)) {
        await Promise.all(result.map(fetchDuration));
      }
    } else if (method === 'get') {
      await fetchDuration(result);
    }

    return context;
  };
};
