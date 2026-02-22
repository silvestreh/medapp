import { Hook, HookContext } from '@feathersjs/feathers';

export const stripPopulateFlag = (): Hook => async (context: HookContext): Promise<HookContext> => {
  if (context.params.query?.$populate) {
    context.params._populate = true;
    delete context.params.query.$populate;
  }
  return context;
};

const populateMembers = (): Hook => async (context: HookContext): Promise<HookContext> => {
  const { app, result, params } = context;

  if (!params._populate) return context;

  const populate = async (item: any) => {
    if (!item.userId) return;
    try {
      const user = await app.service('users').get(item.userId, { provider: undefined } as any);
      item.user = {
        id: user.id,
        username: user.username,
        roleId: user.roleId,
        personalData: user.personalData || null,
        contactData: user.contactData || null,
      };
    } catch {
      item.user = null;
    }
  };

  if (Array.isArray(result?.data)) {
    await Promise.all(result.data.map(populate));
  } else if (Array.isArray(result)) {
    await Promise.all(result.map(populate));
  }

  return context;
};

export default populateMembers;
