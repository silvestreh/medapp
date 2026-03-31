import { HookContext } from '@feathersjs/feathers';
import { mergeWith, isArray } from 'lodash';

export const mergePreferences = () => async (context: HookContext) => {
  const { data, service, id } = context;
  const user = await service.get(id as string);

  if (!user || !data.preferences) return context;

  const merged = mergeWith({}, user.preferences || {}, data.preferences, (_objValue: unknown, srcValue: unknown) => {
    if (isArray(srcValue)) return srcValue;
  });

  data.preferences = merged;

  return context;
};
