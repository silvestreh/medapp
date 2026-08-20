import { Hook, HookContext } from '@feathersjs/feathers';
import { QueryTypes, Transaction } from 'sequelize';
import { randomUUID } from 'crypto';
import { computeAccessLogHash } from './access-log-hash';

export const computeAccessLogHashHook = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { data, app } = context;
    const organizationId = data.organizationId;

    // Skip hash chain for entries without an organization
    if (!organizationId) return context;

    const sequelize = app.get('sequelizeClient');

    // Serialize log creation per organization with a transaction-level
    // advisory lock. A session-level lock released in a later hook can land on
    // a different pooled connection, where the unlock silently fails and the
    // lock stays held by an idle connection. The transaction pins every query
    // (lock, previous-log read, and the INSERT itself via params.sequelize) to
    // one connection, and pg_advisory_xact_lock releases automatically at
    // commit/rollback.
    let transaction: Transaction | undefined = context.params.sequelize?.transaction;

    if (!transaction) {
      transaction = await sequelize.transaction();
      context.params.sequelize = { ...context.params.sequelize, transaction };
      // Only commit/rollback transactions this hook opened — a caller-provided
      // transaction is the caller's to finish.
      context.params._accessLogTransactionOwned = true;
    }

    await sequelize.query(
      'SELECT pg_advisory_xact_lock(hashtext(:lockKey))',
      {
        replacements: { lockKey: `access-log:${organizationId}` },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    // Find the most recent access log for this organization using raw query
    // to avoid triggering the full hook pipeline
    const results = await sequelize.query(
      `SELECT id, hash FROM access_logs
       WHERE "organizationId" = :organizationId
       ORDER BY "createdAt" DESC, id DESC
       LIMIT 1`,
      {
        replacements: { organizationId },
        type: QueryTypes.SELECT,
        transaction
      }
    ) as Array<{ id: string; hash: string | null }>;

    const previousLog = results[0];
    const previousHash = previousLog?.hash || null;
    const previousLogId = previousLog?.id || null;

    // Ensure the log entry has an ID before hashing
    if (!data.id) {
      data.id = randomUUID();
    }

    // Ensure defaults are set before hashing (Sequelize defaults apply at DB level, too late for hashing)
    if (!data.purpose) {
      data.purpose = 'treatment';
    }

    data.hash = computeAccessLogHash(data, previousHash);
    data.previousLogId = previousLogId;

    return context;
  };
};
