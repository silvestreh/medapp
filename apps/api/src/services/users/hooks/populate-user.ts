import { HookContext } from '@feathersjs/feathers';
import { getUserPermissions } from '../../../utils/get-user-permissions';

const populateUser = () => {
  return async (context: HookContext) => {
    const { app, result } = context;

    if (result.roleId) {
      const mergedPermissions = await getUserPermissions(app, result.id, result.roleId);

      result.role = {
        id: result.roleId,
        permissions: mergedPermissions
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
