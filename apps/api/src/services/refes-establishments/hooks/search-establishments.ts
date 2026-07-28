import { HookContext } from '@feathersjs/feathers';
import { Op, Sequelize } from 'sequelize';

/**
 * Translates a `$search` query param into an accent-insensitive multi-word
 * match over the establishment name, REFES code, city, department and
 * province. Every word must match at least one of those fields.
 */
export const searchEstablishments = () => {
  return async (context: HookContext) => {
    const { params } = context;
    const { query = {} } = params;

    if (!query.$search) {
      return context;
    }

    const searchTerm = String(query.$search);
    delete query.$search;

    const searchWords = searchTerm
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((word: string) => word.length > 0);

    if (searchWords.length === 0) {
      return context;
    }

    const wordConditions = searchWords.map((word: string) => {
      return {
        [Op.or]: [
          { id: { [Op.iLike]: `%${word}%` } },
          Sequelize.where(
            Sequelize.fn('unaccent', Sequelize.col('name')),
            { [Op.iLike]: `%${word}%` }
          ),
          Sequelize.where(
            Sequelize.fn('unaccent', Sequelize.col('city')),
            { [Op.iLike]: `%${word}%` }
          ),
          Sequelize.where(
            Sequelize.fn('unaccent', Sequelize.col('department')),
            { [Op.iLike]: `%${word}%` }
          ),
          Sequelize.where(
            Sequelize.fn('unaccent', Sequelize.col('province')),
            { [Op.iLike]: `%${word}%` }
          )
        ]
      };
    });

    // Merge into the query (same pattern as search-medications) so other
    // query params — e.g. the default isActive filter — keep applying.
    const existing = query as Record<string | symbol, unknown>;
    const existingAnd = (existing[Op.and] as unknown[]) || [];

    context.params.query = {
      ...query,
      [Op.and]: [...existingAnd, ...wordConditions]
    };

    return context;
  };
};
