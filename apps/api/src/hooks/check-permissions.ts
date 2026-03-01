import { Hook, HookContext } from '@feathersjs/feathers';
import { Forbidden } from '@feathersjs/errors';
import { getUserPermissions } from '../utils/get-user-permissions';

interface CheckPermissionOptions {
  foreignKey?: string;
  fields?: string[];
  scopeToOrganization?: boolean;
}

export const checkPermissions = (options: CheckPermissionOptions = {}): Hook => {
  const { scopeToOrganization = true } = options;

  return async (context: HookContext): Promise<HookContext> => {
    const { app, data, params, method, id, service, path } = context;

    if (params.provider === undefined || !params.user) {
      return context;
    }

    if (params.isSuperAdmin) {
      if (scopeToOrganization && params.organizationId) {
        applyOrgScoping(context, params.organizationId, method, id, service);
      }
      return context;
    }

    const permissions: string[] = params.orgPermissions
      || await getUserPermissions(app, params.user.id, params.organizationId);

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

    if (scopeToOrganization && params.organizationId) {
      await applyOrgScoping(context, params.organizationId, method, id, service);
    }

    if (hasAllPermission) {
      return context;
    }

    if (method === 'find' && options.foreignKey) {
      context.params.query = {
        ...context.params.query,
        [options.foreignKey]: params.user.id
      };
      return context;
    }

    if (method === 'create' && options.foreignKey) {
      context.data = {
        ...context.data,
        [options.foreignKey]: params.user.id
      };
      return context;
    }

    if (['get', 'update', 'patch', 'remove'].includes(method) && options.foreignKey) {
      if (!id) {
        throw new Forbidden('ID is required for this operation');
      }

      const record = await service.get(id);

      if (record[options.foreignKey] !== params.user.id) {
        throw new Forbidden('You can only access your own records');
      }
    }

    return context;
  };
};

async function applyOrgScoping(
  context: HookContext, orgId: string, method: string, id: any, service: any
): Promise<void> {
  if (method === 'find') {
    context.params.query = {
      ...context.params.query,
      organizationId: orgId
    };
  }

  if (method === 'create') {
    context.data = {
      ...context.data,
      organizationId: orgId
    };
  }

  if (['get', 'update', 'patch', 'remove'].includes(method) && id) {
    const record = await service.get(id, { ...context.params, provider: undefined });
    if (record.organizationId && record.organizationId !== orgId) {
      throw new Forbidden('This record belongs to a different organization');
    }
  }
}
