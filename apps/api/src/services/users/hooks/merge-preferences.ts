import { HookContext } from '@feathersjs/feathers';
import { merge } from 'lodash';

export const mergePreferences = () => async (context: HookContext) => {
  const { data, service, id } = context;
  const user = await service.get(id as string);

  if (!user || !data.preferences) return context;

  const merged = merge({}, user.preferences || {}, data.preferences);

  data.preferences = merged;

  return context;
};
