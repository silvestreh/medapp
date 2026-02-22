import { type HookContext } from '@feathersjs/feathers';

export const lowerCase = (field: string) => async (context: HookContext): Promise<HookContext> => {
  const { data } = context;

  if (data[field]) {
    data[field] = data[field].toLowerCase();
  }

  return context;
};
