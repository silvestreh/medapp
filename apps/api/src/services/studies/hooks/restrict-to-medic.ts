import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import { getUserPermissions } from '../../../utils/get-user-permissions';

export default function restrictToMedic(): Hook {
  return async (context: HookContext) => {
    const { app, params, method, id, service } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    const { user } = params;
    const permissions = await getUserPermissions(app, user.id, user.roleId);
    const allPermission = `studies:${method}:all`;

    if (permissions.includes(allPermission)) {
      return context;
    }

    if (method === 'create') {
      context.data = { ...context.data, medicId: user.id };
      return context;
    }

    if (method === 'find') {
      context.params.query = {
        ...context.params.query,
        medicId: user.id,
      };
      return context;
    }

    if (['get', 'patch', 'remove'].includes(method) && id) {
      const record = await service.get(id, { ...params, provider: undefined });

      if (record.medicId !== user.id) {
        throw new Forbidden('You can only access your own studies');
      }
    }

    return context;
  };
}
