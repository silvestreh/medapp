import { Hook, HookContext } from '@feathersjs/feathers';

type Entity = 'user' | 'patient';

const patchPersonalData = (entity: Entity): Hook => async (context: HookContext) => {
  const { app, data, result } = context;
  const personalData = (data as any)?.personalData;
  if (!personalData || Object.keys(personalData).length === 0) return context;

  const joinData = await app.service(`${entity}-personal-data`).find({
    query: { ownerId: result.id, $limit: 1 },
    paginate: false,
  }) as any[];

  if (joinData[0]?.personalDataId) {
    await app.service('personal-data').patch(
      joinData[0].personalDataId,
      personalData,
      { provider: undefined }
    );
  }

  return context;
};

export default patchPersonalData;
