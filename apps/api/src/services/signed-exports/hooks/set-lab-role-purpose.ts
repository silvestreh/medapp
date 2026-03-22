import { Hook, HookContext } from '@feathersjs/feathers';

export const setLabRolePurpose = (): Hook => {
  return (context: HookContext): HookContext => {
    const orgRoleIds: string[] = context.params.orgRoleIds || [];
    if (!orgRoleIds.includes('medic') && (orgRoleIds.includes('lab-tech') || orgRoleIds.includes('lab-owner'))) {
      context.params.accessPurpose = 'record-management';
    }
    return context;
  };
};
