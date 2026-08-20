import { Hook, HookContext } from '@feathersjs/feathers';
import logger from '../../../logger';

export const rollbackStudyTransaction = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params._studyTransactionOwned) return context;

    const transaction = context.params.sequelize?.transaction;

    delete context.params._studyTransactionOwned;
    if (context.params.sequelize) {
      delete context.params.sequelize.transaction;
    }

    if (transaction) {
      try {
        // Rolling back also releases the pg_advisory_xact_lock taken in
        // auto-protocol.
        await transaction.rollback();
      } catch (error) {
        // Never mask the original service error with a rollback failure.
        logger.error('Failed to roll back study transaction', error);
      }
    }

    return context;
  };
};
