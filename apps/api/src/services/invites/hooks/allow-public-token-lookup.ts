import { Hook, HookContext } from '@feathersjs/feathers';

const allowPublicTokenLookup = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { params } = context;

  if (params.query?.token && params.provider) {
    context.params = { ...params, authenticated: true };
  }

  return context;
};

export default allowPublicTokenLookup;
