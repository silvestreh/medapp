import { Hook, HookContext } from '@feathersjs/feathers';

const sanitizeFindResult = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { params, result } = context;

  if (!params.user && params.provider) {
    const sanitize = (item: any) => ({
      id: item.id,
      organizationId: item.organizationId,
      status: item.status,
      expiresAt: item.expiresAt,
      userId: item.userId,
      token: item.token,
      isNewUser: item.isNewUser,
    });

    if (result?.data) {
      result.data = result.data.map(sanitize);
    } else if (Array.isArray(result)) {
      context.result = result.map(sanitize);
    }
  }

  return context;
};

export default sanitizeFindResult;
