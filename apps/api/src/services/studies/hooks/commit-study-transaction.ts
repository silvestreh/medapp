import { Hook, HookContext } from '@feathersjs/feathers';

export const commitStudyTransaction = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params._studyTransactionOwned) return context;

    const transaction = context.params.sequelize?.transaction;

    // Clear the transaction before committing so later hooks (and error hooks,
    // if one of them throws) never see a finished transaction on params.
    delete context.params._studyTransactionOwned;
    if (context.params.sequelize) {
      delete context.params.sequelize.transaction;
    }

    if (transaction) {
      // Committing also releases the pg_advisory_xact_lock that serializes
      // protocol assignment, so this hook must run first in after.create.
      await transaction.commit();
    }

    return context;
  };
};
