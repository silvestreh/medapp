import { Hook, HookContext } from '@feathersjs/feathers';
import { QueryTypes, Transaction } from 'sequelize';
import { randomUUID } from 'crypto';
import { computeEncounterHash } from './encounter-hash';

export const computeEncounterHashHook = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { data, app } = context;
    const patientId = data.patientId;
    const sequelize = app.get('sequelizeClient');

    // Serialize encounter creation per patient with a transaction-level
    // advisory lock. A session-level lock released in a later hook can land on
    // a different pooled connection, where the unlock silently fails and the
    // lock stays held by an idle connection. The transaction pins every query
    // (lock, previous-encounter read, and the INSERT itself via
    // params.sequelize) to one connection, and pg_advisory_xact_lock releases
    // automatically at commit/rollback.
    let transaction: Transaction | undefined = context.params.sequelize?.transaction;

    if (!transaction) {
      transaction = await sequelize.transaction();
      context.params.sequelize = { ...context.params.sequelize, transaction };
      // Only commit/rollback transactions this hook opened — a caller-provided
      // transaction is the caller's to finish.
      context.params._encounterTransactionOwned = true;
    }

    await sequelize.query(
      'SELECT pg_advisory_xact_lock(hashtext(:lockKey))',
      {
        replacements: { lockKey: `enc:${patientId}` },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    // Find the most recent encounter for this patient using raw query
    // to avoid triggering the full hook pipeline
    const results = await sequelize.query(
      `SELECT id, hash, date FROM encounters
       WHERE "patientId" = :patientId
       ORDER BY date DESC, id DESC
       LIMIT 1`,
      {
        replacements: { patientId },
        type: QueryTypes.SELECT,
        transaction
      }
    ) as Array<{ id: string; hash: string | null; date: Date }>;

    const previousEncounter = results[0];
    const previousHash = previousEncounter?.hash || null;
    const previousEncounterId = previousEncounter?.id || null;

    // Ensure the encounter has an ID before hashing (Sequelize default
    // is generated later, but the hash must include the final ID)
    if (!data.id) {
      data.id = randomUUID();

      // Same-date encounters are tie-broken by id, both when picking the
      // previous encounter above and when verification walks the chain, so a
      // generated id must sort after the previous encounter's id or the two
      // orderings disagree and the chain reads as broken.
      if (
        previousEncounter &&
        new Date(previousEncounter.date).getTime() === new Date(data.date).getTime()
      ) {
        while (String(data.id) <= String(previousEncounter.id)) {
          data.id = randomUUID();
        }
      }
    }

    // Compute hash from plaintext data (before encryption)
    data.hash = computeEncounterHash(data, previousHash);
    data.previousEncounterId = previousEncounterId;

    return context;
  };
};
