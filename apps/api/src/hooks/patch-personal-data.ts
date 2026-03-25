import { Hook, HookContext } from '@feathersjs/feathers';
import { omit, merge } from 'lodash';

type Entity = 'user' | 'patient';

const patchPersonalData = (entity: Entity): Hook => async (context: HookContext) => {
  const { app, data, result } = context;
  const personalData = (data as any)?.personalData;
  if (!personalData || Object.keys(personalData).length === 0) return context;

  const joinService = app.service(`${entity}-personal-data`);

  const joinData = await joinService.find({
    query: { ownerId: result.id, $limit: 1 },
    paginate: false,
  }) as any[];

  if (!joinData[0]?.personalDataId) return context;

  // If documentValue is changing, check if a personal_data record already exists
  // with that value (unique constraint). If so, re-associate instead of patching.
  if (personalData.documentValue) {
    const existing = await app.service('personal-data').find({
      query: { documentValue: personalData.documentValue, $limit: 1 },
      paginate: false,
      provider: undefined,
    }) as any[];

    if (existing.length > 0 && existing[0].id !== joinData[0].personalDataId) {
      const rest = omit(personalData, 'documentValue');

      if (Object.keys(rest).length > 0) {
        const merged = merge({}, existing[0], rest);
        await app.service('personal-data').patch(
          existing[0].id,
          merged,
          { provider: undefined }
        );
      }
      await joinService.patch(
        joinData[0].id,
        { personalDataId: existing[0].id },
        { provider: undefined }
      );
      return context;
    }
  }

  const currentRecord = await app.service('personal-data').get(
    joinData[0].personalDataId,
    { provider: undefined },
  );

  const merged = merge({}, currentRecord, personalData);

  await app.service('personal-data').patch(
    joinData[0].personalDataId,
    merged,
    { provider: undefined }
  );

  return context;
};

export default patchPersonalData;
