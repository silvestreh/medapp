import { Hook, HookContext } from '@feathersjs/feathers';
import { QueryTypes } from 'sequelize';
import { randomUUID } from 'crypto';
import { computeAccessLogHash } from './access-log-hash';

export const computeAccessLogHashHook = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { data, app } = context;
    const organizationId = data.organizationId;

    // Skip hash chain for entries without an organization
    if (!organizationId) return context;

    const sequelize = app.get('sequelizeClient');

    // Acquire advisory lock to serialize log creation per organization
    await sequelize.query(
      'SELECT pg_advisory_lock(hashtext(:lockKey))',
      {
        replacements: { lockKey: `access-log:${organizationId}` },
        type: QueryTypes.SELECT
      }
    );

    // Store lock key so the release hook can unlock
    context.params._accessLogLockKey = `access-log:${organizationId}`;

    // Find the most recent access log for this organization using raw query
    // to avoid triggering the full hook pipeline
    const results = await sequelize.query(
      `SELECT id, hash FROM access_logs
       WHERE "organizationId" = :organizationId
       ORDER BY "createdAt" DESC, id DESC
       LIMIT 1`,
      {
        replacements: { organizationId },
        type: QueryTypes.SELECT
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
