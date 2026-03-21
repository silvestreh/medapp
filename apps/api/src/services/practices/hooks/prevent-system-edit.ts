import { Hook, HookContext } from '@feathersjs/feathers';
import { BadRequest } from '@feathersjs/errors';

async function getPracticeRaw(context: HookContext, id: any): Promise<any> {
  const sequelize = context.app.get('sequelizeClient');
  const { practices } = sequelize.models;
  return practices.findByPk(id, { raw: true });
}

export const preventSystemEdit = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { id, data } = context;

    if (!id) {
      return context;
    }

    const practice = await getPracticeRaw(context, id);
    if (!practice || !practice.isSystem) {
      return context;
    }

    const protectedFields = ['title', 'description', 'isSystem', 'systemKey'];
    for (const field of protectedFields) {
      if (field in data) {
        throw new BadRequest(`Cannot modify ${field} on system practices`);
      }
    }

    return context;
  };
};

export const preventSystemRemoval = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { id } = context;

    if (!id) {
      return context;
    }

    const practice = await getPracticeRaw(context, id);
    if (practice && practice.isSystem) {
      throw new BadRequest('Cannot delete system practices');
    }

    return context;
  };
};
