import { Hook, HookContext } from '@feathersjs/feathers';

export const commitAccessLogTransaction = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params._accessLogTransactionOwned) return context;

    const transaction = context.params.sequelize?.transaction;

    // Clear the transaction before committing so later hooks (and error hooks,
    // if one of them throws) never see a finished transaction on params.
    delete context.params._accessLogTransactionOwned;
    if (context.params.sequelize) {
      delete context.params.sequelize.transaction;
    }

    if (transaction) {
      // Committing also releases the pg_advisory_xact_lock that serializes
      // log creation per organization, so this hook must run first in
      // after.create.
      await transaction.commit();
    }

    return context;
  };
};
