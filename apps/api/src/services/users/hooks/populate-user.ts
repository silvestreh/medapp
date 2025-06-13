import { HookContext } from '@feathersjs/feathers';

const populateUser = () => {
  return async (context: HookContext) => {
    const { app, result } = context;

    if (result.roleId) {
      const role = await app.service('roles').get(result.roleId);

      result.role = {
        id: role.id,
        permissions: role.permissions
      };
    }

    if (result.roleId === 'medic') {
      const [settings] = await app.service('md-settings').find({
        query: {
          userId: result.id
        },
        paginate: false
      });
      result.settings = settings;
    }

    context.result = result;

    return context;
  };
};

export default populateUser;
