import { HookContext } from '@feathersjs/feathers';

export const patchMdSettings = () => async (context: HookContext) => {
  const { app, data, result, id } = context;

  if (!id) return context;
  if (!result) return context;
  if (!data.mdSettings) return context;

  const [mdSettings] = await app.service('md-settings').find({
    query: { userId: id, $limit: 1 },
    paginate: false,
  });

  if (!mdSettings) return context;

  await app.service('md-settings').patch(mdSettings.id, data.mdSettings);
  return context;
};
