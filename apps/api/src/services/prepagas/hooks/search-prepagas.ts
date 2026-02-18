import { HookContext } from '@feathersjs/feathers';
import { Op, Sequelize } from 'sequelize';

export const searchPrepagas = () => {
  return async (context: HookContext) => {
    const { params } = context;
    const { query = {} } = params;

    if (!query.$search) {
      return context;
    }

    const searchTerm = query.$search;
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
      return Sequelize.where(
        Sequelize.fn(
          'immutable_unaccent',
          Sequelize.fn(
            'lower',
            Sequelize.literal('"shortName" || \' \' || "denomination"'),
          ),
        ),
        { [Op.iLike]: `%${word}%` },
      );
    });

    const existingAnd = (query as any)[Op.and] || [];

    (context.params.query as any) = {
      ...query,
      [Op.and]: [...existingAnd, ...wordConditions],
    };

    return context;
  };
};
