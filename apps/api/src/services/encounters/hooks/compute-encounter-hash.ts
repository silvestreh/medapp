import { Hook, HookContext } from '@feathersjs/feathers';
import { QueryTypes } from 'sequelize';
import { randomUUID } from 'crypto';
import { computeEncounterHash } from './encounter-hash';

export const computeEncounterHashHook = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { data, app } = context;
    const patientId = data.patientId;
    const sequelize = app.get('sequelizeClient');

    // Acquire advisory lock to serialize encounter creation per patient
    await sequelize.query(
      'SELECT pg_advisory_lock(hashtext(:lockKey))',
      {
        replacements: { lockKey: `enc:${patientId}` },
        type: QueryTypes.SELECT
      }
    );

    // Store patientId on params so the release hook can unlock
    context.params._encounterLockKey = `enc:${patientId}`;

    // Find the most recent encounter for this patient using raw query
    // to avoid triggering the full hook pipeline
    const results = await sequelize.query(
      `SELECT id, hash FROM encounters
       WHERE "patientId" = :patientId
       ORDER BY date DESC, id DESC
       LIMIT 1`,
      {
        replacements: { patientId },
        type: QueryTypes.SELECT
      }
    ) as Array<{ id: string; hash: string | null }>;

    const previousEncounter = results[0];
    const previousHash = previousEncounter?.hash || null;
    const previousEncounterId = previousEncounter?.id || null;

    // Ensure the encounter has an ID before hashing (Sequelize default
    // is generated later, but the hash must include the final ID)
    if (!data.id) {
      data.id = randomUUID();
    }

    // Compute hash from plaintext data (before encryption)
    data.hash = computeEncounterHash(data, previousHash);
    data.previousEncounterId = previousEncounterId;

    return context;
  };
};
