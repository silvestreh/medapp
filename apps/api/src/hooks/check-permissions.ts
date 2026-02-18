import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import { getUserPermissions } from '../utils/get-user-permissions';

interface CheckPermissionOptions {
  foreignKey?: string;
  fields?: string[];
}

export const checkPermissions = (options: CheckPermissionOptions = {}): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { app, data, params, method, id, service, path } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    const { user } = params;
    const permissions = await getUserPermissions(app, user.id, user.roleId);
    const basePermission = `${path}:${method}`;
    const allPermission = `${basePermission}:all`;

    const hasAllPermission = permissions.includes(allPermission);
    const hasBasePermission = permissions.includes(basePermission);
    const fieldPermissions = permissions
      .filter((p: string) => p.startsWith(`${basePermission}.`))
      .map((p: string) => p.split('.')[1]);

    if (!hasAllPermission && !hasBasePermission && fieldPermissions.length === 0) {
      throw new Forbidden(`You don't have permission to ${method} on ${context.path}`);
    }

    if (['create', 'patch', 'update'].includes(method) && !hasAllPermission) {
      if (fieldPermissions.length > 0) {
        context.data = Object.keys(data).reduce((sanitized, field) => {
          if (fieldPermissions.includes(field)) {
            sanitized[field] = data[field];
          }
          return sanitized;
        }, {} as Record<string, any>);
      }
    }

    if (hasAllPermission) {
      return context;
    }

    if (method === 'find' && options.foreignKey) {
      context.params.query = {
        ...context.params.query,
        [options.foreignKey]: user.id
      };
      return context;
    }

    if (method === 'create' && options.foreignKey) {
      context.data = {
        ...context.data,
        [options.foreignKey]: user.id
      };
      return context;
    }

    if (['get', 'update', 'patch', 'remove'].includes(method) && options.foreignKey) {
      if (!id) {
        throw new Forbidden('ID is required for this operation');
      }

      const record = await service.get(id);

      if (record[options.foreignKey] !== user.id) {
        throw new Forbidden('You can only access your own records');
      }
    }

    return context;
  };
};
