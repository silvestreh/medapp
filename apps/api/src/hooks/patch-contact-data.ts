import { Hook, HookContext } from '@feathersjs/feathers';
import merge from 'lodash/merge';

type Entity = 'user' | 'patient';

const patchContactData = (entity: Entity): Hook => async (context: HookContext) => {
  const { app, data, result } = context;
  const contactData = (data as any)?.contactData;
  if (!contactData || Object.keys(contactData).length === 0) return context;

  const joinData = await app.service(`${entity}-contact-data`).find({
    query: { ownerId: result.id, $limit: 1 },
    paginate: false,
  }) as any[];

  if (joinData[0]?.contactDataId) {
    const existing = await app.service('contact-data').get(
      joinData[0].contactDataId,
      { provider: undefined },
    );

    const merged = merge({}, existing, contactData);

    await app.service('contact-data').patch(
      joinData[0].contactDataId,
      merged,
      { provider: undefined }
    );
  }

  return context;
};

export default patchContactData;
