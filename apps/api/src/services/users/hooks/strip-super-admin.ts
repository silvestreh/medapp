import { HookContext } from '@feathersjs/feathers';

export const stripSuperAdmin = () => (context: HookContext) => {
  if (context.data) {
    delete context.data.isSuperAdmin;
  }
  return context;
};
