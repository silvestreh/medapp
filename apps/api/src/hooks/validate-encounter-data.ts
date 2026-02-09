import { BadRequest } from '@feathersjs/errors';
import { Hook, HookContext } from '@feathersjs/feathers';

export const validateEncounterData = (): Hook => {
  return async (context: HookContext) => {
    const { data } = context.data;

    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new BadRequest('Encounter data cannot be empty');
    }

    const hasMeaningfulData = Object.values(data).some((form: any) => {
      if (!form || !form.values || typeof form.values !== 'object') return false;

      return Object.values(form.values).some((val: any) => {
        if (Array.isArray(val)) {
          return val.some(v => v && (typeof v !== 'string' || v.trim() !== ''));
        }
        if (typeof val === 'string') {
          return val.trim() !== '';
        }
        return !!val;
      });
    });

    if (!hasMeaningfulData) {
      throw new BadRequest('Encounter data cannot be empty');
    }

    return context;
  };
};
