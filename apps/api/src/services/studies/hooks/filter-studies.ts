import { Hook, HookContext } from '@feathersjs/feathers';
import { Op } from 'sequelize';

/**
 * Before.find hook for studies filtering.
 *
 * Supports:
 * - `dateFrom` / `dateTo`: filter by `date` column (inclusive range)
 * - `studyType`: filter by Postgres array `studies` column using @> (contains)
 *
 * These custom params are stripped from the query so feathers-sequelize
 * doesn't try to match them as column names.
 */
export default function filterStudies(): Hook {
  return async (context: HookContext) => {
    const { params } = context;
    const query = params.query || {};

    const { dateFrom, dateTo, studyType, ...rest } = query;

    const sequelizeWhere: Record<string, unknown> = {};

    if (dateFrom || dateTo) {
      const dateFilter: Record<symbol, string> = {};
      if (dateFrom) dateFilter[Op.gte] = dateFrom;
      if (dateTo) dateFilter[Op.lte] = dateTo;
      sequelizeWhere.date = dateFilter;
    }

    if (studyType) {
      sequelizeWhere.studies = { [Op.contains]: [studyType] };
    }

    if (Object.keys(sequelizeWhere).length > 0) {
      params.sequelize = params.sequelize || {};
      params.sequelize.where = {
        ...(params.sequelize.where || {}),
        ...sequelizeWhere,
      };
    }

    params.query = rest;
    return context;
  };
}
