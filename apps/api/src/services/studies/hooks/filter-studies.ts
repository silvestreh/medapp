import { Hook, HookContext } from '@feathersjs/feathers';
import { Op } from 'sequelize';

/**
 * Before.find hook that handles the `studyType` query param.
 *
 * The `studies` column is a Postgres string array, so we need
 * Sequelize's Op.contains (@>) which Feathers can't express natively.
 * All other filters (date, insurerId, etc.) use standard Feathers
 * query operators and need no hook.
 */
export default function filterStudies(): Hook {
  return async (context: HookContext) => {
    const { query } = context.params;
    if (!query?.studyType) return context;

    context.params.sequelize = {
      ...(context.params.sequelize || {}),
      where: {
        ...((context.params.sequelize || {}).where || {}),
        studies: { [Op.contains]: [query.studyType] },
      },
    };

    delete query.studyType;
    return context;
  };
}
