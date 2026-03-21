import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

export const validatePractice = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { data } = context;

    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      throw new BadRequest('Title is required');
    }

    if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
      throw new BadRequest('Description is required');
    }

    if (data.isSystem) {
      throw new BadRequest('Cannot create system practices via API');
    }

    if (data.systemKey) {
      throw new BadRequest('Cannot set systemKey on custom practices');
    }

    context.data = {
      ...context.data,
      isSystem: false,
      systemKey: null,
    };

    return context;
  };
};
