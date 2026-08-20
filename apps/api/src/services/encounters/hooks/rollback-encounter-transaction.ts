import { Hook, HookContext } from '@feathersjs/feathers';
import logger from '../../../logger';

export const rollbackEncounterTransaction = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params._encounterTransactionOwned) return context;

    const transaction = context.params.sequelize?.transaction;

    delete context.params._encounterTransactionOwned;
    if (context.params.sequelize) {
      delete context.params.sequelize.transaction;
    }

    if (transaction) {
      try {
        // Rolling back also releases the pg_advisory_xact_lock taken in
        // compute-encounter-hash.
        await transaction.rollback();
      } catch (error) {
        // Never mask the original service error with a rollback failure.
        logger.error('Failed to roll back encounter transaction', error);
      }
    }

    return context;
  };
};
