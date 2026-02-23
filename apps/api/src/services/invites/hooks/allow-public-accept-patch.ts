import { Hook, HookContext } from '@feathersjs/feathers';

const allowPublicAcceptPatch = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { data, params } = context;

  if (data?.action === 'accept' && params.provider) {
    context.params = { ...params, authenticated: true, _isAcceptAction: true };
  }

  return context;
};

export default allowPublicAcceptPatch;
