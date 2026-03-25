import { HookContext } from '@feathersjs/feathers';
import merge from 'lodash/merge';

export const patchMdSettings = () => async (context: HookContext) => {
  const { app, data, result, id } = context;

  if (!id) return context;
  if (!result) return context;

  if (!data.mdSettings || Object.keys(data.mdSettings).length === 0) return context;

  const [existing] = await app.service('md-settings').find({
    query: { userId: id, $limit: 1 },
    paginate: false,
  });

  if (!existing) return context;

  const merged = merge({}, existing, data.mdSettings);

  await app.service('md-settings').patch(existing.id, merged, { provider: undefined });
  return context;
};
