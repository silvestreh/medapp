import type { Hook, HookContext } from '@feathersjs/feathers';

/**
 * Strips all fields except the specified ones from external patch requests.
 * This is a hard guard that applies regardless of role permissions.
 */
export const allowPatchFields = (...fields: string[]): Hook => {
  return (context: HookContext): HookContext => {
    if (context.params.provider === undefined) return context;

    context.data = Object.keys(context.data).reduce(
      (filtered: Record<string, unknown>, key: string) => {
        if (fields.includes(key)) {
          filtered[key] = context.data[key];
        }
        return filtered;
      },
      {}
    );

    return context;
  };
};
