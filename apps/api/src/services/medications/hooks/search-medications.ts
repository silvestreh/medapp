import { HookContext } from '@feathersjs/feathers';
import { Op } from 'sequelize';

export const searchMedications = () => {
  return async (context: HookContext) => {
    const { params } = context;
    const { query = {} } = params;

    if (!query.$search) {
      return context;
    }

    const searchTerm = query.$search;
    delete query.$search;

    // Split search term into words and normalize each
    const searchWords = searchTerm
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter((word: string) => word.length > 0);

    if (searchWords.length === 0) {
      return context;
    }

    // Build a query where EACH word must match the unaccented searchText column
    const wordConditions = searchWords.map((word: string) => {
      return {
        searchText: { [Op.iLike]: `%${word}%` }
      };
    });

    // Merge with existing query
    const existingAnd = (query as any)[Op.and] || [];

    context.params.query = {
      ...query,
      [Op.and]: [
        ...existingAnd,
        ...wordConditions
      ]
    };

    return context;
  };
};
