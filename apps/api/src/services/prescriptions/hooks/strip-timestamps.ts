import { Hook, HookContext } from '@feathersjs/feathers';

export const stripTimestamps = (): Hook => {
  return async (context: HookContext) => {
    if (context.data) {
      delete context.data.createdAt;
      delete context.data.updatedAt;
    }
    return context;
  };
};
