import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';

export default function restrictToMedic(): Hook {
  return async (context: HookContext) => {
    const { params, method, id, service } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    const permissions: string[] = params.orgPermissions || [];
    const allPermission = `studies:${method}:all`;

    if (permissions.includes(allPermission)) {
      return context;
    }

    if (method === 'create') {
      context.data = { ...context.data, medicId: params.user.id };
      if (params.organizationId) {
        context.data.organizationId = params.organizationId;
      }
      return context;
    }

    if (method === 'find') {
      context.params.query = {
        ...context.params.query,
        medicId: params.user.id,
      };
      if (params.organizationId) {
        context.params.query.organizationId = params.organizationId;
      }
      return context;
    }

    if (['get', 'patch', 'remove'].includes(method) && id) {
      const record = await service.get(id, { ...params, provider: undefined });

      if (record.medicId !== params.user.id) {
        throw new Forbidden('You can only access your own studies');
      }
    }

    return context;
  };
}
