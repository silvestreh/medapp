import { QueryTypes, Sequelize, Transaction } from 'sequelize';

// Transaction-scoped Postgres advisory locks. The lock lives on the
// transaction's connection and is released automatically when the transaction
// ends, so it can never leak across pooled connections the way a session-level
// pg_advisory_lock / pg_advisory_unlock pair can.

// Blocking variant: waits for the lock, runs `fn` inside the transaction, then
// commits (or rolls back on error). Use for per-resource serialization
// (e.g. one booking slot) where every contender must eventually run.
export async function withXactLock<T>(
  sequelize: Sequelize,
  lockKey: string,
  fn: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:lockKey))', {
      replacements: { lockKey },
      type: QueryTypes.SELECT,
      transaction,
    });

    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => undefined);
    throw error;
  }
}

// Non-blocking variant for cron jobs: a busy lock just skips the cycle. Only
// the lock lives on the transaction — `fn` runs its queries on the pool as
// usual and the transaction is rolled back (releasing the lock) afterwards.
// Resolves to `false` when the lock was held elsewhere.
export async function withTryXactLock(
  sequelize: Sequelize,
  lockKey: string,
  fn: () => Promise<void>
): Promise<boolean> {
  const transaction = await sequelize.transaction();
  let locked = false;

  try {
    const [row] = await sequelize.query(
      'SELECT pg_try_advisory_xact_lock(hashtext(:lockKey)) AS locked',
      { replacements: { lockKey }, type: QueryTypes.SELECT, transaction }
    ) as Array<{ locked: boolean }>;
    locked = row?.locked === true;

    if (locked) {
      await fn();
    }

    return locked;
  } finally {
    await transaction.rollback().catch(() => undefined);
  }
}
