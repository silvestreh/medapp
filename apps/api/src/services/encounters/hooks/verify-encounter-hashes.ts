import { Hook, HookContext } from '@feathersjs/feathers';
import { QueryTypes } from 'sequelize';
import { computeEncounterHash } from './encounter-hash';

export const verifyEncounterHashes = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { method } = context;

    if (method === 'find') {
      const data = context.result.data || context.result;
      if (!Array.isArray(data) || data.length === 0) return context;

      // Sort by date ASC, id ASC to walk the chain
      const sorted = [...data].sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return String(a.id).localeCompare(String(b.id));
      });

      // Build a lookup of id -> hash for chain verification
      const hashById = new Map<string, string>();
      for (const encounter of sorted) {
        if (encounter.hash) {
          hashById.set(encounter.id, encounter.hash);
        }
      }

      // Verify each encounter's hash
      for (const encounter of sorted) {
        if (!encounter.hash) {
          // Pre-backfill encounter, skip verification
          encounter.tampered = false;
          continue;
        }

        const previousHash = encounter.previousEncounterId
          ? (hashById.get(encounter.previousEncounterId) || null)
          : null;

        const expectedHash = computeEncounterHash(encounter, previousHash);
        encounter.tampered = expectedHash !== encounter.hash;
      }
    }

    if (method === 'get') {
      const encounter = context.result;
      if (!encounter?.hash) {
        // Pre-backfill encounter, skip verification
        if (encounter) encounter.tampered = false;
        return context;
      }

      // For a single get, fetch the previous encounter's hash using raw query
      // to avoid triggering hooks recursively
      let previousHash: string | null = null;
      if (encounter.previousEncounterId) {
        const sequelize = context.app.get('sequelizeClient');
        const results = await sequelize.query(
          'SELECT hash FROM encounters WHERE id = :id LIMIT 1',
          {
            replacements: { id: encounter.previousEncounterId },
            type: QueryTypes.SELECT
          }
        ) as Array<{ hash: string | null }>;
        previousHash = results[0]?.hash || null;
      }

      const expectedHash = computeEncounterHash(encounter, previousHash);
      encounter.tampered = expectedHash !== encounter.hash;
    }

    return context;
  };
};
