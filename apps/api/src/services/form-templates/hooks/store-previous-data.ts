import { Hook, HookContext } from '@feathersjs/feathers';

export const storePreviousData = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (context.id) {
      context.params._previousData = await context.app
        .service('form-templates')
        .get(context.id);
    }

    return context;
  };
};
