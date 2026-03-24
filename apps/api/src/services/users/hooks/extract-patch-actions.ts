import { HookContext } from '@feathersjs/feathers';

/**
 * Extract action fields from patch data into params so after-hooks can read them,
 * then strip them from data so Sequelize doesn't try to save them as columns.
 * Ensures patch always has something to update so after hooks fire.
 */
export const extractPatchActions = () => (context: HookContext) => {
  if (!context.data) return context;

  if (context.data.twoFactorSetup) {
    context.params._twoFactorSetup = true;
    delete context.data.twoFactorSetup;
  }

  if (context.data.twoFactorCode) {
    context.params._twoFactorCode = context.data.twoFactorCode;
    delete context.data.twoFactorCode;
  }

  // Ensure patch always has something to update so after hooks fire
  if (Object.keys(context.data).length === 0) {
    context.data.updatedAt = new Date();
  }

  return context;
};
