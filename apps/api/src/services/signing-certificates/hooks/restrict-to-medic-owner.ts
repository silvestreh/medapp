import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export const restrictToMedicOwner = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { params, method } = context;
  const user = params?.user;

  if (!params.provider || !user) return context;

  if ((user as any).roleId !== 'medic') {
    throw new Forbidden('Only medics can manage signing certificates');
  }

  if (method === 'find') {
    context.params.query = { ...context.params.query, userId: user.id };
  }

  if (method === 'create') {
    context.data = { ...context.data, userId: user.id };
  }

  if (method === 'remove') {
    const record = await context.service.get(context.id!, { ...params, provider: undefined });
    if (record.userId !== user.id) {
      throw new Forbidden('You can only remove your own certificate');
    }
  }

  return context;
};
