import { Hook, HookContext } from '@feathersjs/feathers';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';

export default function autoProtocol(): Hook {
  return async (context: HookContext) => {
    if (context.data.protocol) {
      return context;
    }

    const sequelize: Sequelize = context.app.get('sequelizeClient');

    // Protocol numbers are globally unique and assigned as max+1, so the
    // read-and-assign must be serialized against other study creations —
    // without a lock, two concurrent creates read the same max and one fails
    // on the unique constraint. Same pattern as compute-encounter-hash: a
    // transaction-scoped advisory lock pins the lock, the max read, and the
    // INSERT (via params.sequelize) to one transaction, and the
    // commit/rollback hooks finish it, releasing the lock.
    let transaction: Transaction | undefined = context.params.sequelize?.transaction;

    if (!transaction) {
      transaction = await sequelize.transaction();
      context.params.sequelize = { ...context.params.sequelize, transaction };
      // Only commit/rollback transactions this hook opened — a caller-provided
      // transaction is the caller's to finish.
      context.params._studyTransactionOwned = true;
    }

    await sequelize.query(
      'SELECT pg_advisory_xact_lock(hashtext(:lockKey))',
      {
        replacements: { lockKey: 'studies:protocol' },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const maxProtocol = await sequelize.models.studies.max('protocol', { transaction }) as number | null;

    context.data.protocol = (maxProtocol ?? 0) + 1;
    return context;
  };
}
