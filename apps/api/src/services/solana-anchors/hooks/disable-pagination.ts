import { HookContext } from '@feathersjs/feathers';

export const disablePagination = () => (context: HookContext): HookContext => {
  context.params.paginate = false;
  return context;
};
