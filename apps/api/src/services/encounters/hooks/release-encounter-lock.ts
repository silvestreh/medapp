import { Hook, HookContext } from '@feathersjs/feathers';
import { QueryTypes } from 'sequelize';

export const releaseEncounterLock = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const lockKey = context.params._encounterLockKey;
    if (!lockKey) return context;

    const sequelize = context.app.get('sequelizeClient');

    await sequelize.query(
      'SELECT pg_advisory_unlock(hashtext(:lockKey))',
      {
        replacements: { lockKey },
        type: QueryTypes.SELECT
      }
    );

    delete context.params._encounterLockKey;

    return context;
  };
};
