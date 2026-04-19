import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

export const preventPublishedRemoval = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.id) {
      return context;
    }

    const existing = await context.app
      .service('form-templates')
      .get(context.id, { ...context.params, provider: undefined });

    if (existing.status === 'published') {
      throw new BadRequest('Published form templates cannot be deleted');
    }

    return context;
  };
};
