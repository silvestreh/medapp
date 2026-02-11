import { HookContext } from '@feathersjs/feathers';
import { Op, Sequelize } from 'sequelize';

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

    console.log('Searching medications for:', searchWords);

    // Build a query where EACH word must match the unaccented searchText column
    // We use Sequelize.where with unaccent on the concatenated columns as a fallback
    // or just search the searchText column if it's populated.
    const wordConditions = searchWords.map((word: string) => {
      return {
        [Op.or]: [
          { searchText: { [Op.iLike]: `%${word}%` } },
          Sequelize.where(
            Sequelize.fn('immutable_unaccent', Sequelize.fn('lower', Sequelize.literal('"commercialNamePresentation" || \' \' || "genericDrug"'))),
            { [Op.iLike]: `%${word}%` }
          )
        ]
      };
    });

    // Merge with existing query
    const existingAnd = (query as any)[Op.and] || [];

    (context.params.query as any) = {
      ...query,
      [Op.and]: [
        ...existingAnd,
        ...wordConditions
      ]
    };

    return context;
  };
};
